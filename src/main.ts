import {
  App,
  ButtonComponent,
  DropdownComponent,
  FuzzySuggestModal,
  Menu,
  Modal,
  Notice,
  Plugin,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
  TextComponent,
  ToggleComponent,
} from 'obsidian';

// ============================================================================
// Types & Interfaces
// ============================================================================

type PropertyAction = 'add' | 'remove' | 'edit';

type PropertyValueType = 'text' | 'number' | 'checkbox' | 'date' | 'list';

interface PropertyDefinition {
  key: string;
  value: PropertyValue;
  type: PropertyValueType;
}

type PropertyValue = string | number | boolean | string[];

interface FolderOptions {
  includeSubfolders: boolean;
  depthLevel: number; // -1 for infinity
}

interface ExistingProperty {
  key: string;
  values: Set<PropertyValue>;
  types: Set<PropertyValueType>;
}

// ============================================================================
// Folder Picker Modal
// ============================================================================

class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  private folders: TFolder[];
  private onChoose: (folder: TFolder) => void;

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChoose = onChoose;
    this.folders = this.getAllFolders();
    this.setPlaceholder('Select a folder...');
  }

  private getAllFolders(): TFolder[] {
    const folders: TFolder[] = [];
    const root = this.app.vault.getRoot();

    const collectFolders = (folder: TFolder) => {
      folders.push(folder);
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          collectFolders(child);
        }
      }
    };

    collectFolders(root);
    return folders;
  }

  getItems(): TFolder[] {
    return this.folders;
  }

  getItemText(folder: TFolder): string {
    return folder.path || '/';
  }

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder);
  }
}

// ============================================================================
// File/Folder Selection Modal (for commands)
// ============================================================================

class FileSelectionModal extends Modal {
  private plugin: PropertiesCommanderPlugin;
  private action: PropertyAction;
  private selectionMode: 'folder' | 'files' = 'folder';
  private selectedFolder: TFolder | null = null;
  private selectedFiles: TFile[] = [];
  private folderOptions: FolderOptions = {
    includeSubfolders: true,
    depthLevel: -1,
  };
  private contentContainer: HTMLElement | null = null;

  constructor(plugin: PropertiesCommanderPlugin, action: PropertyAction) {
    super(plugin.app);
    this.plugin = plugin;
    this.action = action;
    this.modalEl.addClass('properties-modal');
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('properties-commander-modal');

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
      files = this.plugin.getFilesFromFolder(
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
        new AddPropertiesModal(this.plugin, files, folder).open();
        break;
      case 'remove':
        new RemovePropertiesModal(this.plugin, files, folder).open();
        break;
      case 'edit':
        new EditPropertiesModal(this.plugin, files, folder).open();
        break;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ============================================================================
// Base Properties Modal
// ============================================================================

abstract class BasePropertiesModal extends Modal {
  protected plugin: PropertiesCommanderPlugin;
  protected files: TFile[];
  protected folder: TFolder | null;
  protected folderOptions: FolderOptions;
  protected existingProperties: Map<string, ExistingProperty>;

  constructor(plugin: PropertiesCommanderPlugin, files: TFile[], folder: TFolder | null = null) {
    super(plugin.app);
    this.plugin = plugin;
    this.files = files;
    this.folder = folder;
    this.folderOptions = {
      includeSubfolders: true,
      depthLevel: -1,
    };
    this.existingProperties = new Map();
    this.modalEl.addClass('properties-modal');
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('properties-commander-modal');

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

  protected fileCountEl: HTMLElement | null = null;

  protected async refreshFilesFromFolder() {
    if (this.folder) {
      this.files = this.plugin.getFilesFromFolder(
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
      const props = await this.plugin.getPropertiesFromFile(file);
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
        prop.values.add(value);
        prop.types.add(this.plugin.detectValueType(value));
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

// ============================================================================
// Add Properties Modal
// ============================================================================

class AddPropertiesModal extends BasePropertiesModal {
  private propertiesToAdd: PropertyDefinition[] = [];
  private listContainer: HTMLElement | null = null;

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Add properties' });
    container.createEl('p', {
      text: `Adding properties to ${this.files.length} file(s)`,
      cls: 'properties-commander-subtitle',
    });

    // Properties list
    this.listContainer = container.createDiv({
      cls: 'properties-commander-properties-list',
    });

    // Add initial empty property row
    this.addPropertyRow();

    // Add more button
    const addMoreContainer = container.createDiv({
      cls: 'properties-commander-add-more',
    });
    new ButtonComponent(addMoreContainer).setButtonText('Add another property').onClick(() => this.addPropertyRow());

    // Existing properties hint
    if (this.existingProperties.size > 0) {
      const hintEl = container.createDiv({
        cls: 'properties-commander-existing-hint',
      });
      hintEl.createEl('span', { text: 'Existing properties: ' });
      const propsPreview = Array.from(this.existingProperties.keys()).slice(0, 8).join(', ');
      hintEl.createEl('code', {
        text: propsPreview + (this.existingProperties.size > 8 ? '...' : ''),
      });
    }

    // Action buttons
    const buttonContainer = container.createDiv({
      cls: 'properties-commander-button-row',
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Add properties')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  private addPropertyRow() {
    if (!this.listContainer) return;

    const index = this.propertiesToAdd.length;
    this.propertiesToAdd.push({ key: '', value: '', type: 'text' });

    const rowEl = this.listContainer.createDiv({
      cls: 'properties-commander-property-row',
    });

    // Key input
    const keyContainer = rowEl.createDiv({ cls: 'properties-commander-key-input' });
    keyContainer.createEl('label', { text: 'Key' });
    new TextComponent(keyContainer).setPlaceholder('Property name').onChange((value) => {
      const prop = this.propertiesToAdd[index];
      if (prop) prop.key = value.trim();
    });

    // Value input (created first so we can reference it in type change handler)
    const valueContainer = rowEl.createDiv({ cls: 'properties-commander-value-input' });
    valueContainer.createEl('label', { text: 'Value' });
    this.createValueInput(valueContainer, index, 'text');

    // Type selector
    const typeContainer = rowEl.createDiv({ cls: 'properties-commander-type-input' });
    typeContainer.createEl('label', { text: 'Type' });
    new DropdownComponent(typeContainer)
      .addOption('text', 'Text')
      .addOption('number', 'Number')
      .addOption('checkbox', 'Checkbox')
      .addOption('date', 'Date')
      .addOption('list', 'List')
      .setValue('text')
      .onChange((value) => {
        const prop = this.propertiesToAdd[index];
        if (prop) {
          prop.type = value as PropertyValueType;
          this.updateValueInput(index, valueContainer, value as PropertyValueType);
        }
      });

    // Remove button
    const removeBtn = rowEl.createDiv({ cls: 'properties-commander-remove-btn' });
    new ButtonComponent(removeBtn)
      .setIcon('x')
      .setTooltip('Remove')
      .onClick(() => {
        this.propertiesToAdd.splice(index, 1);
        rowEl.remove();
      });
  }

  private createValueInput(container: HTMLElement, index: number, type: PropertyValueType) {
    container.empty();
    container.createEl('label', { text: 'Value' });

    const prop = this.propertiesToAdd[index];
    if (!prop) return;

    switch (type) {
      case 'checkbox':
        new ToggleComponent(container).setValue(false).onChange((value) => {
          prop.value = value;
        });
        break;
      case 'number': {
        const numInput = container.createEl('input', {
          type: 'number',
          cls: 'properties-commander-input',
        });
        numInput.addEventListener('input', () => {
          prop.value = parseFloat(numInput.value) || 0;
        });
        break;
      }
      case 'date': {
        const dateInput = container.createEl('input', {
          type: 'date',
          cls: 'properties-commander-input',
        });
        dateInput.addEventListener('input', () => {
          prop.value = dateInput.value;
        });
        break;
      }
      case 'list':
        new TextComponent(container).setPlaceholder('Item 1, item 2, item 3').onChange((value) => {
          prop.value = value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s);
        });
        break;
      default: // text
        new TextComponent(container).setPlaceholder('Value').onChange((value) => {
          prop.value = value;
        });
    }
  }

  private updateValueInput(index: number, container: HTMLElement, type: PropertyValueType) {
    const prop = this.propertiesToAdd[index];
    if (!prop) return;
    prop.value =
      type === 'checkbox' ? false
      : type === 'number' ? 0
      : type === 'list' ? []
      : '';
    this.createValueInput(container, index, type);
  }

  private async handleSubmit() {
    const validProps = this.propertiesToAdd.filter((p) => p.key.length > 0);

    if (validProps.length === 0) {
      new Notice('Please add at least one property with a key');
      return;
    }

    let successCount = 0;

    for (const file of this.files) {
      const result = await this.plugin.addPropertiesToFile(file, validProps);
      if (result > 0) successCount++;
    }

    new Notice(`Added ${validProps.length} property(ies) to ${successCount} file(s)`);
    this.close();
  }
}

// ============================================================================
// Remove Properties Modal
// ============================================================================

class RemovePropertiesModal extends BasePropertiesModal {
  private selectedKeys: Set<string> = new Set();

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Remove properties' });
    container.createEl('p', {
      text: `Removing properties from ${this.files.length} file(s)`,
      cls: 'properties-commander-subtitle',
    });

    if (this.existingProperties.size === 0) {
      container.createEl('p', {
        text: 'No properties found in selected files.',
        cls: 'properties-commander-no-items',
      });
      return;
    }

    container.createEl('p', {
      text: 'Toggle on the properties you want to remove:',
      cls: 'properties-commander-batch-desc',
    });

    const listContainer = container.createDiv({
      cls: 'properties-commander-list',
    });

    Array.from(this.existingProperties.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach((prop) => {
        const itemEl = listContainer.createDiv({
          cls: 'properties-commander-list-item',
        });

        new ToggleComponent(itemEl).setValue(this.selectedKeys.has(prop.key)).onChange((value) => {
          if (value) {
            this.selectedKeys.add(prop.key);
          } else {
            this.selectedKeys.delete(prop.key);
          }
        });

        const labelContainer = itemEl.createDiv({
          cls: 'properties-commander-property-label',
        });
        labelContainer.createEl('span', {
          text: prop.key,
          cls: 'properties-commander-key',
        });

        const valuesPreview = Array.from(prop.values)
          .slice(0, 3)
          .map((v) => this.formatValue(v))
          .join(', ');
        labelContainer.createEl('span', {
          text: valuesPreview + (prop.values.size > 3 ? '...' : ''),
          cls: 'properties-commander-values-preview',
        });
      });

    // Action buttons
    const buttonContainer = container.createDiv({
      cls: ['properties-commander-button-row', 'properties-commander-button-row-remove'],
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Remove properties')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  private formatValue(value: PropertyValue | null | undefined): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{...}';
    return String(value).slice(0, 20);
  }

  protected onPropertiesReloaded() {
    this.selectedKeys.clear();
  }

  private async handleSubmit() {
    if (this.selectedKeys.size === 0) {
      new Notice('Please select at least one property to remove');
      return;
    }

    const keysToRemove = Array.from(this.selectedKeys);
    let successCount = 0;

    for (const file of this.files) {
      const removed = await this.plugin.removePropertiesFromFile(file, keysToRemove);
      if (removed > 0) successCount++;
    }

    new Notice(`Removed ${keysToRemove.length} property(ies) from ${successCount} file(s)`);
    this.close();
  }
}

// ============================================================================
// Edit Properties Modal
// ============================================================================

interface PropertyEdit {
  originalKey: string;
  newKey: string;
  enabled: boolean;
  type: PropertyValueType;
  value: PropertyValue;
  originalValue: PropertyValue;
}

class EditPropertiesModal extends BasePropertiesModal {
  private propertyEdits: Map<string, PropertyEdit> = new Map();
  private addToFilesWithoutProperty: boolean = false;
  private listContainer: HTMLElement | null = null;

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Edit properties' });
    container.createEl('p', {
      text: `Editing properties in ${this.files.length} file(s)`,
      cls: 'properties-commander-subtitle',
    });

    if (this.existingProperties.size === 0) {
      container.createEl('p', {
        text: 'No properties found in selected files.',
        cls: 'properties-commander-no-items',
      });
      return;
    }

    // Properties list
    this.listContainer = container.createDiv({
      cls: 'properties-commander-edit-list',
    });

    // Initialize edits from existing properties
    this.initializePropertyEdits();
    this.renderPropertyRows();

    // Global option for adding to files without the property
    new Setting(container)
      .setName('Add to files without property')
      .setDesc("If enabled, files that don't have an edited property will receive it")
      .addToggle((toggle) =>
        toggle.setValue(this.addToFilesWithoutProperty).onChange((value) => {
          this.addToFilesWithoutProperty = value;
        }),
      )
      .setClass('properties-setting-item-toggle-container');

    // Action buttons
    const buttonContainer = container.createDiv({
      cls: 'properties-commander-button-row',
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Apply changes')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  private initializePropertyEdits() {
    this.propertyEdits.clear();

    Array.from(this.existingProperties.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, prop]) => {
        // Get the most common value as default
        const valuesArray = Array.from(prop.values);
        const firstValue = valuesArray[0];
        const defaultValue: PropertyValue = firstValue !== undefined ? firstValue : '';
        const detectedType = this.plugin.detectValueType(defaultValue);

        this.propertyEdits.set(key, {
          originalKey: key,
          newKey: key,
          enabled: false,
          type: detectedType,
          value: defaultValue,
          originalValue: defaultValue,
        });
      });
  }

  private renderPropertyRows() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    // Header row
    const headerEl = this.listContainer.createDiv({ cls: 'properties-commander-edit-header' });
    headerEl.createEl('span', { text: '', cls: 'properties-commander-edit-header-toggle' });
    headerEl.createEl('span', { text: 'Property name', cls: 'properties-commander-edit-header-key' });
    headerEl.createEl('span', { text: 'Type', cls: 'properties-commander-edit-header-type' });
    headerEl.createEl('span', { text: 'Value', cls: 'properties-commander-edit-header-value' });

    this.propertyEdits.forEach((edit, key) => {
      this.renderPropertyRow(edit);
    });
  }

  private renderPropertyRow(edit: PropertyEdit) {
    if (!this.listContainer) return;

    const rowEl = this.listContainer.createDiv({
      cls: 'properties-commander-edit-row',
    });

    // Enable toggle
    const toggleContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-toggle' });
    new ToggleComponent(toggleContainer).setValue(edit.enabled).onChange((value) => {
      edit.enabled = value;
      rowEl.toggleClass('properties-commander-edit-row-enabled', value);
    });

    // Property key (editable input)
    const keyContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-key' });
    new TextComponent(keyContainer)
      .setValue(edit.newKey)
      .setPlaceholder('Property name')
      .onChange((value) => {
        edit.newKey = value.trim();
      });

    // Type dropdown
    const typeContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-type' });
    new DropdownComponent(typeContainer)
      .addOption('text', 'Text')
      .addOption('number', 'Number')
      .addOption('checkbox', 'Checkbox')
      .addOption('date', 'Date')
      .addOption('list', 'List')
      .setValue(edit.type)
      .onChange((value) => {
        edit.type = value as PropertyValueType;
        // Reset value when type changes
        edit.value = this.getDefaultValueForType(value as PropertyValueType);
        this.updateValueCell(valueContainer, edit);
      });

    // Value input
    const valueContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-value' });
    this.updateValueCell(valueContainer, edit);
  }

  private getDefaultValueForType(type: PropertyValueType): PropertyValue {
    switch (type) {
      case 'checkbox':
        return false;
      case 'number':
        return 0;
      case 'list':
        return [];
      case 'date':
        return '';
      default:
        return '';
    }
  }

  private updateValueCell(container: HTMLElement, edit: PropertyEdit) {
    container.empty();

    switch (edit.type) {
      case 'checkbox':
        new ToggleComponent(container)
          .setValue(typeof edit.value === 'boolean' ? edit.value : false)
          .onChange((value) => {
            edit.value = value;
          });
        break;
      case 'number': {
        const numInput = container.createEl('input', {
          type: 'number',
          cls: 'properties-commander-input',
          value: String(typeof edit.value === 'number' ? edit.value : 0),
        });
        numInput.addEventListener('input', () => {
          edit.value = parseFloat(numInput.value) || 0;
        });
        break;
      }
      case 'date': {
        const dateInput = container.createEl('input', {
          type: 'date',
          cls: 'properties-commander-input',
          value: typeof edit.value === 'string' ? edit.value : '',
        });
        dateInput.addEventListener('input', () => {
          edit.value = dateInput.value;
        });
        break;
      }
      case 'list': {
        const listValue = Array.isArray(edit.value) ? edit.value.join(', ') : '';
        new TextComponent(container)
          .setValue(listValue)
          .setPlaceholder('Item 1, item 2, item 3')
          .onChange((value) => {
            edit.value = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);
          });
        break;
      }
      default: // text
        new TextComponent(container)
          .setValue(typeof edit.value === 'string' ? edit.value : String(edit.value ?? ''))
          .setPlaceholder('Value')
          .onChange((value) => {
            edit.value = value;
          });
    }
  }

  protected onPropertiesReloaded() {
    this.initializePropertyEdits();
    this.renderPropertyRows();
  }

  private async handleSubmit() {
    const enabledEdits = Array.from(this.propertyEdits.values()).filter((e) => e.enabled);

    if (enabledEdits.length === 0) {
      new Notice('Please enable at least one property to edit');
      return;
    }

    let totalRenamed = 0;
    let totalUpdated = 0;
    let totalAdded = 0;

    for (const file of this.files) {
      for (const edit of enabledEdits) {
        // Check if key was renamed
        const keyRenamed = edit.originalKey !== edit.newKey && edit.newKey.length > 0;

        if (keyRenamed) {
          // Rename the key first
          const renamed = await this.plugin.renamePropertyKey(file, edit.originalKey, edit.newKey);
          if (renamed) totalRenamed++;

          // Then update the value
          const result = await this.plugin.updatePropertyValue(
            file,
            edit.newKey,
            edit.value,
            this.addToFilesWithoutProperty,
          );
          if (result === 'updated') totalUpdated++;
          else if (result === 'added') totalAdded++;
        } else {
          // Just update the value
          const result = await this.plugin.updatePropertyValue(
            file,
            edit.originalKey,
            edit.value,
            this.addToFilesWithoutProperty,
          );
          if (result === 'updated') totalUpdated++;
          else if (result === 'added') totalAdded++;
        }
      }
    }

    let messageParts: string[] = [];
    if (totalRenamed > 0) messageParts.push(`renamed ${totalRenamed}`);
    if (totalUpdated > 0) messageParts.push(`updated ${totalUpdated}`);
    if (totalAdded > 0) messageParts.push(`added ${totalAdded}`);

    const message = messageParts.length > 0 ? `Properties: ${messageParts.join(', ')}` : 'No changes made';
    new Notice(message);
    this.close();
  }
}

// ============================================================================
// Main Plugin Class
// ============================================================================

export default class PropertiesCommanderPlugin extends Plugin {
  async onload() {
    console.debug('Loading Properties Commander plugin');

    this.registerContextMenuEvents();
    this.registerCommands();
  }

  onunload() {
    console.debug('Unloading Properties Commander plugin');
  }

  // ========================================================================
  // Context Menu Registration
  // ========================================================================

  private registerContextMenuEvents() {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file, source) => {
        if (source === 'file-explorer-context-menu') {
          this.addPropertiesCommanderMenu(menu, file);
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on('files-menu', (menu, files, source) => {
        if (source === 'file-explorer-context-menu') {
          this.addPropertiesCommanderMenuForFiles(menu, files);
        }
      }),
    );
  }

  private addPropertiesCommanderMenu(menu: Menu, file: TAbstractFile) {
    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('Properties commander').setIcon('list');

      const subMenu = (item as unknown as { setSubmenu: () => Menu }).setSubmenu();

      if (file instanceof TFolder) {
        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Add properties...')
            .setIcon('plus')
            .onClick(() => {
              const files = this.getFilesFromFolder(file, true, -1);
              new AddPropertiesModal(this, files, file).open();
            });
        });

        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Remove properties...')
            .setIcon('minus')
            .onClick(() => {
              const files = this.getFilesFromFolder(file, true, -1);
              new RemovePropertiesModal(this, files, file).open();
            });
        });

        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Edit properties...')
            .setIcon('pencil')
            .onClick(() => {
              const files = this.getFilesFromFolder(file, true, -1);
              new EditPropertiesModal(this, files, file).open();
            });
        });
      } else if (file instanceof TFile && file.extension === 'md') {
        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Add properties...')
            .setIcon('plus')
            .onClick(() => {
              new AddPropertiesModal(this, [file]).open();
            });
        });

        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Remove properties...')
            .setIcon('minus')
            .onClick(() => {
              new RemovePropertiesModal(this, [file]).open();
            });
        });

        subMenu.addItem((subItem) => {
          subItem
            .setTitle('Edit properties...')
            .setIcon('pencil')
            .onClick(() => {
              new EditPropertiesModal(this, [file]).open();
            });
        });
      }
    });
  }

  private addPropertiesCommanderMenuForFiles(menu: Menu, files: TAbstractFile[]) {
    const mdFiles = files.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');

    if (mdFiles.length === 0) return;

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('Properties commander').setIcon('list');

      const subMenu = (item as unknown as { setSubmenu: () => Menu }).setSubmenu();

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Add Properties to ${mdFiles.length} files...`)
          .setIcon('plus')
          .onClick(() => {
            new AddPropertiesModal(this, mdFiles).open();
          });
      });

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Remove Properties from ${mdFiles.length} files...`)
          .setIcon('minus')
          .onClick(() => {
            new RemovePropertiesModal(this, mdFiles).open();
          });
      });

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Edit Properties in ${mdFiles.length} files...`)
          .setIcon('pencil')
          .onClick(() => {
            new EditPropertiesModal(this, mdFiles).open();
          });
      });
    });
  }

  // ========================================================================
  // Command Registration
  // ========================================================================

  private registerCommands() {
    this.addCommand({
      id: 'add-properties',
      name: 'Add properties...',
      callback: () => new FileSelectionModal(this, 'add').open(),
    });

    this.addCommand({
      id: 'remove-properties',
      name: 'Remove properties...',
      callback: () => new FileSelectionModal(this, 'remove').open(),
    });

    this.addCommand({
      id: 'edit-properties',
      name: 'Edit properties...',
      callback: () => new FileSelectionModal(this, 'edit').open(),
    });
  }

  // ========================================================================
  // File & Property Utilities
  // ========================================================================

  getFilesFromFolder(
    folder: TFolder,
    includeSubfolders: boolean,
    depthLevel: number,
    currentDepth: number = 0,
  ): TFile[] {
    const files: TFile[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        files.push(child);
      } else if (child instanceof TFolder && includeSubfolders && (depthLevel === -1 || currentDepth < depthLevel)) {
        files.push(...this.getFilesFromFolder(child, includeSubfolders, depthLevel, currentDepth + 1));
      }
    }

    return files;
  }

  async getPropertiesFromFile(file: TFile): Promise<Record<string, PropertyValue>> {
    const properties: Record<string, PropertyValue> = {};

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(frontmatter)) {
          if (this.isPropertyValue(value)) {
            properties[key] = value;
          }
        }
      });
    } catch {
      // File might not have frontmatter
    }

    return properties;
  }

  private isPropertyValue(value: unknown): value is PropertyValue {
    if (typeof value === 'string') return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return true;
    return false;
  }

  detectValueType(value: PropertyValue): PropertyValueType {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    return 'text';
  }

  async addPropertiesToFile(file: TFile, properties: PropertyDefinition[]): Promise<number> {
    let added = 0;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const prop of properties) {
          if (!prop.key) continue;

          // Only add if key doesn't exist or we're overwriting
          if (!(prop.key in frontmatter)) {
            frontmatter[prop.key] = prop.value;
            added++;
          }
        }
      });
    } catch (error) {
      console.error(`Error adding properties to ${file.path}:`, error);
    }

    return added;
  }

  async removePropertiesFromFile(file: TFile, keys: string[]): Promise<number> {
    let removed = 0;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const key of keys) {
          if (key in frontmatter) {
            delete frontmatter[key];
            removed++;
          }
        }
      });
    } catch (error) {
      console.error(`Error removing properties from ${file.path}:`, error);
    }

    return removed;
  }

  async renamePropertyKey(file: TFile, oldKey: string, newKey: string): Promise<boolean> {
    let renamed = false;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (oldKey in frontmatter) {
          frontmatter[newKey] = frontmatter[oldKey];
          delete frontmatter[oldKey];
          renamed = true;
        }
      });
    } catch (error) {
      console.error(`Error renaming property in ${file.path}:`, error);
    }

    return renamed;
  }

  async updatePropertyValue(
    file: TFile,
    key: string,
    value: PropertyValue,
    addIfMissing: boolean,
  ): Promise<'updated' | 'added' | 'none'> {
    let result: 'updated' | 'added' | 'none' = 'none';

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (key in frontmatter) {
          frontmatter[key] = value;
          result = 'updated';
        } else if (addIfMissing) {
          frontmatter[key] = value;
          result = 'added';
        }
      });
    } catch (error) {
      console.error(`Error updating property in ${file.path}:`, error);
    }

    return result;
  }
}
