import { ButtonComponent, DropdownComponent, Notice, TextComponent, TFile, TFolder, ToggleComponent } from 'obsidian';
import type { PropertyDefinition, PropertyValueType } from '../types';
import { PropertyUtils } from '../utils/property-utils';
import { BasePropertiesModal } from './base-properties-modal';

/**
 * Modal for adding new properties to files
 */
export class AddPropertiesModal extends BasePropertiesModal {
  private propertiesToAdd: PropertyDefinition[] = [];
  private listContainer: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils, files, folder);
  }

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
    prop.value = this.propertyUtils.getDefaultValueForType(type);
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
      const result = await this.propertyUtils.addPropertiesToFile(file, validProps);
      if (result > 0) successCount++;
    }

    new Notice(`Added ${validProps.length} property(ies) to ${successCount} file(s)`);
    this.close();
  }
}
