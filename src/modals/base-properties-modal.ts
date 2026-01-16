import { Modal, Setting, TFile, TFolder } from 'obsidian';
import type { ExistingProperty, FolderOptions } from '../types';
import { PropertyUtils } from '../utils/property-utils';

/**
 * Abstract base class for property operation modals
 */
export abstract class BasePropertiesModal extends Modal {
  protected propertyUtils: PropertyUtils;
  protected files: TFile[];
  protected folder: TFolder | null;
  protected folderOptions: FolderOptions;
  protected existingProperties: Map<string, ExistingProperty>;
  protected fileCountEl: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils['app']);
    this.propertyUtils = propertyUtils;
    this.files = files;
    this.folder = folder;
    this.folderOptions = {
      includeSubfolders: true,
      depthLevel: -1,
    };
    this.existingProperties = new Map();
    this.modalEl.addClass('properties-commander-modal');
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    if (this.folder) {
      this.renderFolderOptions(contentEl);
    }

    await this.loadExistingProperties();
    this.renderContent(contentEl);
  }

  protected renderFolderOptions(container: HTMLElement) {
    const folderSection = container.createDiv({
      cls: 'properties-commander-folder-options',
    });
    folderSection.createEl('h4', { text: 'Folder options' });
    folderSection.createEl('p', {
      text: `Target: ${this.folder?.path || '/'}`,
      cls: 'properties-commander-folder-path',
    });

    new Setting(folderSection)
      .setName('Include subfolders')
      .setDesc('Process files in subdirectories')
      .addToggle((toggle) =>
        toggle.setValue(this.folderOptions.includeSubfolders).onChange(async (value) => {
          this.folderOptions.includeSubfolders = value;
          await this.refreshFilesFromFolder();
        }),
      );

    new Setting(folderSection)
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
          .onChange(async (value) => {
            this.folderOptions.depthLevel = parseInt(value);
            await this.refreshFilesFromFolder();
          }),
      );

    this.fileCountEl = folderSection.createEl('p', {
      text: `Files to process: ${this.files.length}`,
      cls: 'properties-commander-file-count',
    });
  }

  protected async refreshFilesFromFolder() {
    if (this.folder) {
      this.files = this.propertyUtils.getFilesFromFolder(
        this.folder,
        this.folderOptions.includeSubfolders,
        this.folderOptions.depthLevel,
      );
      if (this.fileCountEl) {
        this.fileCountEl.setText(`Files to process: ${this.files.length}`);
      }
      await this.loadExistingProperties();
      this.onPropertiesReloaded();
    }
  }

  protected async loadExistingProperties() {
    this.existingProperties.clear();

    for (const file of this.files) {
      const props = await this.propertyUtils.getPropertiesFromFile(file);
      for (const [key, value] of Object.entries(props)) {
        if (key === 'tags') continue; // Skip tags, handled by Tag Commander

        if (!this.existingProperties.has(key)) {
          this.existingProperties.set(key, {
            key,
            values: new Set(),
            types: new Set(),
          });
        }

        const prop = this.existingProperties.get(key)!;
        // Add the value (including null for empty properties)
        prop.values.add(value);
        prop.types.add(this.propertyUtils.detectValueType(value));
      }
    }
  }

  protected onPropertiesReloaded() {}

  abstract renderContent(container: HTMLElement): void;

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
