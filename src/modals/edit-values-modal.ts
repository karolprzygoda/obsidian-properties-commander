import {
  ButtonComponent,
  DropdownComponent,
  Notice,
  Setting,
  TextComponent,
  TFile,
  TFolder,
  ToggleComponent,
} from 'obsidian';
import type { PropertyValue, PropertyValueEdit, PropertyValueType } from '../types';
import { PropertyUtils } from '../utils/property-utils';
import { BasePropertiesModal } from './base-properties-modal';

/**
 * Modal for editing property values in files
 */
export class EditValuesModal extends BasePropertiesModal {
  private propertyEdits: Map<string, PropertyValueEdit> = new Map();
  private addToFilesWithoutProperty: boolean = false;
  private listContainer: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils, files, folder);
  }

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Edit property values' });
    container.createEl('p', {
      text: `Editing property values in ${this.files.length} file(s)`,
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
      .setButtonText('Update values')
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
        // Handle null/empty values - convert to empty string for editing
        const defaultValue: PropertyValue = firstValue !== undefined ? firstValue : '';
        const editableValue: PropertyValue = defaultValue === null ? '' : defaultValue;
        const detectedType = this.propertyUtils.detectValueType(defaultValue);

        this.propertyEdits.set(key, {
          key,
          enabled: false,
          type: detectedType,
          value: editableValue,
          originalValue: defaultValue,
        });
      });
  }

  private renderPropertyRows() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    // Header row
    const headerEl = this.listContainer.createDiv({ cls: 'properties-commander-values-header' });
    headerEl.createEl('span', { text: '', cls: 'properties-commander-values-header-toggle' });
    headerEl.createEl('span', { text: 'Property', cls: 'properties-commander-values-header-key' });
    headerEl.createEl('span', { text: 'Type', cls: 'properties-commander-values-header-type' });
    headerEl.createEl('span', { text: 'New value', cls: 'properties-commander-values-header-value' });

    this.propertyEdits.forEach((edit) => {
      this.renderPropertyRow(edit);
    });
  }

  private renderPropertyRow(edit: PropertyValueEdit) {
    if (!this.listContainer) return;

    const rowEl = this.listContainer.createDiv({
      cls: 'properties-commander-values-row',
    });

    // Enable toggle
    const toggleContainer = rowEl.createDiv({ cls: 'properties-commander-values-cell-toggle' });

    // Property key (read-only)
    const keyContainer = rowEl.createDiv({ cls: 'properties-commander-values-cell-key' });
    keyContainer.createEl('span', {
      text: edit.key,
      cls: 'properties-commander-values-key',
    });

    // Type dropdown
    const typeContainer = rowEl.createDiv({ cls: 'properties-commander-values-cell-type' });
    const typeDropdown = new DropdownComponent(typeContainer)
      .addOption('text', 'Text')
      .addOption('number', 'Number')
      .addOption('checkbox', 'Checkbox')
      .addOption('date', 'Date')
      .addOption('list', 'List')
      .setValue(edit.type)
      .onChange((value) => {
        edit.type = value as PropertyValueType;
        // Reset value when type changes
        edit.value = this.propertyUtils.getDefaultValueForType(value as PropertyValueType);
        this.updateValueCell(valueContainer, edit);
      });

    // Value input
    const valueContainer = rowEl.createDiv({ cls: 'properties-commander-values-cell-value' });
    this.updateValueCell(valueContainer, edit);

    // Set initial disabled state
    typeDropdown.setDisabled(!edit.enabled);
    typeContainer.toggleClass('properties-commander-disabled', !edit.enabled);
    valueContainer.toggleClass('properties-commander-disabled', !edit.enabled);

    // Toggle component (created after inputs so we can reference them)
    new ToggleComponent(toggleContainer).setValue(edit.enabled).onChange((value) => {
      edit.enabled = value;
      rowEl.toggleClass('properties-commander-values-row-enabled', value);
      typeDropdown.setDisabled(!value);
      typeContainer.toggleClass('properties-commander-disabled', !value);
      valueContainer.toggleClass('properties-commander-disabled', !value);
    });
  }

  private updateValueCell(container: HTMLElement, edit: PropertyValueEdit) {
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
      new Notice('Please select at least one property to update');
      return;
    }

    let totalUpdated = 0;
    let totalAdded = 0;

    for (const file of this.files) {
      for (const edit of enabledEdits) {
        const result = await this.propertyUtils.updatePropertyValue(
          file,
          edit.key,
          edit.value,
          this.addToFilesWithoutProperty,
        );
        if (result === 'updated') totalUpdated++;
        else if (result === 'added') totalAdded++;
      }
    }

    const messageParts: string[] = [];
    if (totalUpdated > 0) messageParts.push(`updated ${totalUpdated}`);
    if (totalAdded > 0) messageParts.push(`added ${totalAdded}`);

    const message = messageParts.length > 0 ? `Properties: ${messageParts.join(', ')}` : 'No changes made';
    new Notice(message);
    this.close();
  }
}
