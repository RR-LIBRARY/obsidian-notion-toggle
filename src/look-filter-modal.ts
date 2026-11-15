import { App, Modal, Setting } from "obsidian";
import { CALLOUT_LOOK_OPTIONS, normalizeCalloutTypes } from "./look-filter";

/** Mobile-friendly checklist: checked types keep Obsidian's native callout look. */
export class CalloutFormatModal extends Modal {
  private selected: string[];

  constructor(
    app: App,
    selected: readonly string[],
    private onChange: (types: string[]) => Promise<void> | void,
  ) {
    super(app);
    this.selected = normalizeCalloutTypes(selected);
  }

  onOpen(): void {
    this.setTitle("Callout format filter");
    this.contentEl.addClass("ntt-callout-format-modal");
    this.contentEl.createDiv({
      cls: "setting-item-description",
      text: "Checked types show Obsidian's icon, colour box and chevron. Unchecked types use the plain Notion toggle. No note text is changed.",
    });

    new Setting(this.contentEl)
      .setName("Quick selection")
      .setDesc("All Notion also turns Notion appearance back on. Number-specific choices, if any, still take priority.")
      .addButton((button) => button.setButtonText("All Notion").onClick(async () => {
        this.selected = [];
        await this.onChange([]);
        this.renderList();
      }))
      .addButton((button) => button.setButtonText("All callouts").onClick(async () => {
        this.selected = CALLOUT_LOOK_OPTIONS.map((option) => option.type);
        await this.onChange(this.selected);
        this.renderList();
      }));

    const list = this.contentEl.createDiv({ cls: "ntt-callout-format-list" });
    this.renderList(list);
  }

  private renderList(existing?: HTMLElement): void {
    const list = existing ?? this.contentEl.querySelector<HTMLElement>(".ntt-callout-format-list");
    if (!list) return;
    list.empty();
    for (const option of CALLOUT_LOOK_OPTIONS) {
      new Setting(list)
        .setName(option.label)
        .setDesc(option.type)
        .addToggle((toggle) => toggle.setValue(this.selected.includes(option.type)).onChange(async (checked) => {
          this.selected = checked
            ? normalizeCalloutTypes([...this.selected, option.type])
            : this.selected.filter((type) => type !== option.type);
          await this.onChange(this.selected);
        }));
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
