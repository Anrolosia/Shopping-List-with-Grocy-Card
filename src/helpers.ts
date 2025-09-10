// ----------------------- Dependency Helper (FR/EN) --------------------------
import { html, TemplateResult } from "lit";

export type SlwgDep = { tag: string; label: string; link?: string };

export const SLWG_REQUIRED_CARDS: SlwgDep[] = [
  { tag: "button-card",         label: "Button Card by @RomRider", link: "https://github.com/custom-cards/button-card"},
  { tag: "layout-card",         label: "Layout Card by @thomasloven", link: "https://github.com/thomasloven/lovelace-layout-card"},
  { tag: "collapsable-cards",   label: "Collapsable Cards by @RossMcMillan92", link: "https://github.com/RossMcMillan92/lovelace-collapsable-cards"},
  { tag: "bootstrap-grid-card", label: "Bootstrap Grid Card by @ownbee", link: "https://github.com/ownbee/bootstrap-grid-card"},
];

/**
 * Returns the list of missing dependencies (custom elements not registered).
 * Also logs a compact console report for troubleshooting.
 */
export function slwgCheckMissingDeps(
  deps: SlwgDep[] = SLWG_REQUIRED_CARDS
): SlwgDep[] {
  // Graceful guard if customElements is not available for any reason
  const ce = (globalThis as any)?.customElements;
  if (!ce?.get) {
    console.warn(
      "Shopping-List-with-Grocy-Card: customElements API not available; " +
      "dependency check skipped."
    );
    return [];
  }

  const missing = deps.filter(d => !ce.get(d.tag));

  if (missing.length) {
    console.group(
      "%cShopping-List-with-Grocy-Card: Missing dependencies",
      "color:#b00;font-weight:bold;"
    );
    for (const m of missing) {
      console.error(`Missing dependency -> <${m.tag}>  |  ${m.label}  |  ${m.link}`);
    }
    console.info(
      "Install via HACS (recommended) or add as Lovelace resources, then reload the UI."
    );
    console.groupEnd();
  }

  return missing;
}

/**
 * Renders a small in-card bilingual error (FR/EN) explaining what is missing.
 * Use directly inside Lit's render():
 *
 *   if (this._missingDeps.length) return slwgRenderDepsErrorCard(this._missingDeps);
 */
export function slwgRenderDepsErrorCard(missing: SlwgDep[]): TemplateResult {
  return html`
    <style>
      ha-card.slwg-error {
        border-left: 4px solid var(--error-color, #db4437);
        padding: 12px 16px;
      }
      .slwg-title { font-weight: 600; margin-bottom: 6px; }
      .slwg-sub   { color: var(--secondary-text-color); margin-bottom: 8px; }
      .slwg-code  {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }
      .slwg-list { line-height: 1.4; }
    </style>

    <ha-card class="slwg-error">
      <div class="slwg-title">Shopping-List-with-Grocy-Card</div>
      <div class="slwg-sub">Missing dependencies</div>

      <div class="slwg-list">
        ${missing.map(m => html`<div>• &lt;${m.tag}&gt; — <a href="${m.link}" target="_blank">${m.label}</a></div>`)}
      </div>

      <br />
      <div>
        Install via HACS (recommended) or add as Lovelace resources, then reload the UI.
      </div>
    </ha-card>
  `;
}


export interface ProductConfig {
  entity_id: string;
  attributes?: ProductEntity;
}

export interface ProductEntity {
  aggregated_opened?: BigInteger;
  aggregated_stock?: BigInteger;
  aggregated_unopened?: BigInteger;
  calories?: BigInteger;
  consume_location?: string;
  cumulate_min_stock_amount_of_sub_products?: string;
  default_best_before_days?: string;
  default_best_before_days_after_freezing?: string;
  default_best_before_days_after_open?: string;
  default_best_before_days_after_thawing?: string;
  due_type?: string;
  group?: string;
  list_count?: BigInteger;
  location?: string;
  min_stock_amount?: string;
  move_on_open?: string;
  no_own_stock?: string;
  parent_product_id?: string;
  product_id?: string;
  product_image?: string;
  qty_in_stock?: string;
  qty_opened?: BigInteger;
  qty_unit_purchase?: string;
  qty_unit_stock?: string;
  qty_unopened?: BigInteger;
  qu_factor_purchase_to_stock?: string;
  qu_id_purchase?: string;
  qu_id_stock?: string;
  quick_consume_amount?: string;
  should_not_be_frozen?: string;
  topic?: string;
  treat_opened_as_out_of_stock?: string;
  friendly_name: string;
}

export const compare_deep = (a: any, b: any) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (!(a instanceof Object && b instanceof Object)) return false;
  for (const x in a) {
    if (!a.hasOwnProperty(x)) continue;
    if (!b.hasOwnProperty(x)) return false;
    if (a[x] === b[x]) continue;
    if (typeof a[x] !== 'object') return false;
    if (!compare_deep(a[x], b[x])) return false;
  }
  for (const x in b) {
    if (!b.hasOwnProperty(x)) continue;
    if (!a.hasOwnProperty(x)) return false;
  }
  return true;
};

export const get_products = (states, config, is_shopping_list = false) => {
  let cpt = 0;
  let productArray = Object.entries(states).filter(([key]) => key.includes('shopping_list_with_grocy_product_v'));
  if (is_shopping_list && config?.shopping_list_id) {
    productArray = productArray.filter(
      ([, value]) => (value as ProductConfig).attributes['list_' + config.shopping_list_id + '_qty'] > 0,
    );
  }
  if (config?.exclude) {
    for (const [exclude_key, exclude_values] of Object.entries(config.exclude)) {
      for (const exclude_value of Object.values(exclude_values)) {
        productArray = productArray.filter(
          ([, value]) => (value as ProductConfig).attributes[exclude_key] !== exclude_value,
        );
      }
    }
  }
  if (config?.include) {
    for (const [include_key, include_values] of Object.entries(config.include)) {
      for (const include_value of Object.values(include_values)) {
        productArray = productArray.filter(
          ([, value]) => (value as ProductConfig).attributes[include_key] === include_value,
        );
      }
    }
  }
  productArray = sorter(productArray, config?.sort_by);
  if (config.hasOwnProperty('group_by') && config.group_by !== '') {
    const grouped_by = [];
    Object.values(productArray).map((value) => {
      const entity = value[1] as ProductConfig;
      const group_by = config.group_by.trim();
      if (entity.attributes[group_by]) {
        if (!(entity.attributes[group_by] in grouped_by)) {
          grouped_by[entity.attributes[group_by]] = [];
        }
        grouped_by[entity.attributes[group_by]].push(entity);
      }
    });
    productArray = grouped_by;
  } else {
    productArray.forEach(function (v: Array<unknown>) {
      v[0] = cpt++;
    });
  }

  return productArray;
};

export const sorter = (data, fields) => {
  return data.sort((a, b) => {
    let value = 0;
    for (let i = 0; i < fields.length; i++) {
      value = value || a[1].attributes[fields[i]].localeCompare(b[1].attributes[fields[i]]);
      if (value) break;
    }
    return value;
  });
};
