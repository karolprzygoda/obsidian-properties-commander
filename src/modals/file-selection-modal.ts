import { ButtonComponent, Modal, Notice, Setting, TFile, TFolder, ToggleComponent } from 'obsidian';
import type { FolderOptions, PropertyAction } from '../types';
import { PropertyUtils } from '../utils/property-utils';
import { AddPropertiesModal } from './add-properties-modal';
import { EditPropertiesModal } from './edit-properties-modal';
import { FolderPickerModal } from './folder-picker-modal';
import { RemovePropertiesModal } from './remove-properties-modal';

/**
 * Modal for selecting files or folders before property operations
 */
export class FileSelectionModal extends Modal {
  private propertyUtils: PropertyUtils;
  private action: PropertyAction;
  private selectionMode: 'folder' | 'files' = 'folder';
  private selectedFolder: TFolder | null = null;
  private selectedFiles: TFile[] = [];
  private folderOptions: FolderOptions = {
    includeSubfolders: true,
    depthLevel: -1,
  };
  private contentContainer: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, action: PropertyAction) {
    super(propertyUtils['app']);
    this.propertyUtils = propertyUtils;
    this.action = action;
    this.modalEl.addClass('properties-commander-modal');
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const actionName =
      this.action === 'add' ? 'Add Properties'
      : this.action === 'remove' ? 'Remove Properties'
      : 'Edit Properties';

    contentEl.createEl('h2', { text: `${actionName} - Select Target` });
    contentEl.createEl('p', {
      text: 'Choose files or a folder to operate on',
      cls: 'properties-commander-subtitle',
    });

    // Selection mode
    new Setting(contentEl)
      .setName('Selection mode')
      .setDesc('Choose how to select target files')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('folder', 'Select a folder')
          .addOption('files', 'Select individual files')
          .setValue(this.selectionMode)
          .onChange((value) => {
            this.selectionMode = value as 'folder' | 'files';
            this.renderSelectionContent();
          }),
      );

    this.contentContainer = contentEl.createDiv({
      cls: 'properties-commander-selection-content',
    });
    this.renderSelectionContent();

    // Action buttons
    const buttonContainer = contentEl.createDiv({
      cls: 'properties-commander-button-row',
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Continue')
      .setCta()
      .onClick(() => this.handleContinue());
  }

  private renderSelectionContent() {
    if (!this.contentContainer) return;
    this.contentContainer.empty();

    if (this.selectionMode === 'folder') {
      this.renderFolderSelection(this.contentContainer);
    } else {
      this.renderFileSelection(this.contentContainer);
    }
  }

  private renderFolderSelection(container: HTMLElement) {
    const folderSetting = new Setting(container)
      .setName('Target folder')
      .setDesc(this.selectedFolder ? `Selected: ${this.selectedFolder.path || '/'}` : 'No folder selected');

    folderSetting.addButton((button) =>
      button.setButtonText('Browse...').onClick(() => {
        new FolderPickerModal(this.app, (folder) => {
          this.selectedFolder = folder;
          folderSetting.setDesc(`Selected: ${folder.path || '/'}`);
        }).open();
      }),
    );

    new Setting(container)
      .setName('Include subfolders')
      .setDesc('Process files in subdirectories')
      .addToggle((toggle) =>
        toggle.setValue(this.folderOptions.includeSubfolders).onChange((value) => {
          this.folderOptions.includeSubfolders = value;
        }),
      );

    new Setting(container)
      .setName('Depth level')
      .setDesc('How deep to traverse (-1 for infinite)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('-1', 'Infinite')
          .addOption('1', '1 level')
          .addOption('2', '2 levels')
          .addOption('3', '3 levels')
          .addOption('5', '5 levels')
          .addOption('10', '10 levels')
          .setValue(String(this.folderOptions.depthLevel))
          .onChange((value) => {
            this.folderOptions.depthLevel = parseInt(value);
          }),
      );
  }

  private renderFileSelection(container: HTMLElement) {
    const allFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

    container.createEl('p', {
      text: `Select files to process (${this.selectedFiles.length} selected):`,
      cls: 'properties-commander-batch-desc',
    });

    const listContainer = container.createDiv({
      cls: 'properties-commander-list',
    });

    allFiles.forEach((file) => {
      const itemEl = listContainer.createDiv({
        cls: 'properties-commander-list-item',
      });

      new ToggleComponent(itemEl).setValue(this.selectedFiles.includes(file)).onChange((value) => {
        if (value) {
          this.selectedFiles.push(file);
        } else {
          this.selectedFiles = this.selectedFiles.filter((f) => f !== file);
        }
        const desc = container.querySelector('.properties-commander-batch-desc');
        if (desc) {
          desc.textContent = `Select files to process (${this.selectedFiles.length} selected):`;
        }
      });

      itemEl.createEl('span', {
        text: file.path,
        cls: 'properties-commander-item-label',
      });
    });
  }

  private handleContinue() {
    let files: TFile[] = [];
    let folder: TFolder | null = null;

    if (this.selectionMode === 'folder') {
      if (!this.selectedFolder) {
        new Notice('Please select a folder');
        return;
      }
      folder = this.selectedFolder;
      files = this.propertyUtils.getFilesFromFolder(
        this.selectedFolder,
        this.folderOptions.includeSubfolders,
        this.folderOptions.depthLevel,
      );
    } else {
      if (this.selectedFiles.length === 0) {
        new Notice('Please select at least one file');
        return;
      }
      files = this.selectedFiles;
    }

    if (files.length === 0) {
      new Notice('No Markdown files found in selection');
      return;
    }

    this.close();

    switch (this.action) {
      case 'add':
        new AddPropertiesModal(this.propertyUtils, files, folder).open();
        break;
      case 'remove':
        new RemovePropertiesModal(this.propertyUtils, files, folder).open();
        break;
      case 'edit':
        new EditPropertiesModal(this.propertyUtils, files, folder).open();
        break;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
