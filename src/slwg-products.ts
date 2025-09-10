import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { ProductConfig, compare_deep, get_products, slwgCheckMissingDeps, slwgRenderDepsErrorCard, SLWG_REQUIRED_CARDS, SlwgDep } from './helpers';

interface LovelaceRowConfig {
  entity?: string;
  type?: string;
}
type EntityList = Array<LovelaceRowConfig>;
type CardList = Array<unknown>;

class ShoppingListWithGrocyProductCard extends LitElement {
  @property() _config;
  @property() hass: any;
  @property() card;
  @property() _missingDeps: SlwgDep[] = [];

  _entities: EntityList;
  _cardsEntities: CardList;
  _cardBuilt?: Promise<void>;
  _cardBuiltResolve?;

  static getStubConfig() {
    return {
      sort_by: ['friendly_name'],
      exclude: {},
      include: {},
      shopping_list_id: 1,
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error('No configuration.');
    }
    this._missingDeps = slwgCheckMissingDeps(SLWG_REQUIRED_CARDS);
    if (config.hasOwnProperty('display_as_poster')) {
      if (config.display_as_poster) {
        if (config.hasOwnProperty('group_by') && config.group_by !== '') {
          throw new Error('group_by has to be defined only when display_as_poster is false');
        }
      }
    }

    config = JSON.parse(JSON.stringify(config));
    config.sort_by = config.sort_by || ['friendly_name'];
    config.group_by = config.group_by || '';
    config.display_as_poster = config.hasOwnProperty('display_as_poster') ? config.display_as_poster : false;
    config.tap_action = config.tap_action || { action: 'none' };
    config.hold_action = config.hold_action || { action: 'none' };
    config.double_tap_action = config.double_tap_action || { action: 'none' };

    this._config = config;

    this._cardBuilt = new Promise((resolve) => (this._cardBuiltResolve = resolve));

    queueMicrotask(() => this.update_all());
  }

  findAndReplace(object, search, replacement, results?, parents?) {
    let key;

    results = results || {};
    parents = parents || [''];

    if (typeof object === 'object') {
      for (key in object) {
        if (object.hasOwnProperty(key)) {
          if (typeof object[key] === 'string' && object[key] == search) {
            object[key] = replacement;
          }
          if (typeof object[key] === 'object') {
            this.findAndReplace(object[key], search, replacement, results, parents.concat(key));
          }
        }
      }
    }
  }

  async update_all() {
    if (this.card) this.card.hass = this.hass;

    const entities = await this.update_entities();
    this.update_card(entities);
  }

  async update_entities(): Promise<EntityList> {
    const states = this.hass.states;

    const entities: EntityList = [...[]];

    if (!this.hass) {
      return entities;
    }

    const productArray = get_products(states, this._config);
    if (this._config.hasOwnProperty('group_by') && this._config.group_by !== '') {
      let default_open = true;
      Object.entries(productArray).map((value) => {
        const location = value[0];
        const products = value[1];
        const location_cards = [];
        Object.values(products).map((entity: ProductConfig) => {
          const tap_action = JSON.parse(JSON.stringify(this._config.tap_action));
          this.findAndReplace(tap_action, '[PRODUCT_ID]', entity.entity_id);
          const hold_action = JSON.parse(JSON.stringify(this._config.hold_action));
          this.findAndReplace(hold_action, '[PRODUCT_ID]', entity.entity_id);
          const double_tap_action = JSON.parse(JSON.stringify(this._config.double_tap_action));
          this.findAndReplace(double_tap_action, '[PRODUCT_ID]', entity.entity_id);
          let cardConfig = {
            type: 'custom:button-card',
            show_icon: false,
            entity: entity.entity_id,
            tap_action: tap_action,
            hold_action: hold_action,
            double_tap_action: double_tap_action,
            styles: {
              grid: [
                { 'grid-template-rows': '1fr' },
                { 'grid-template-areas': "'n qty_in_list'" },
                { 'grid-template-columns': '1fr min-content' },
              ],
              card: [
                { padding: '2% 4%' },
                {
                  'background-color':
                    "[[[ if ('list_" +
                    this._config.shopping_list_id +
                    "_note' in entity.attributes && entity.attributes.list_" +
                    this._config.shopping_list_id +
                    "_note == 'out_of_stock') return 'red'; else return 'var( --ha-card-background, var(--card-background-color, white) )'; ]]]",
                },
              ],
              name: [{ 'align-self': 'center' }, { 'text-align': 'left' }, { width: '100%' }],
              custom_fields: {
                qty_in_list: [{ 'align-self': 'center' }, { 'justify-self': 'start' }, { 'padding-left': '8px' }],
              },
            },
            custom_fields: {
              qty_in_list:
                "[[[ if ('list_" +
                this._config.shopping_list_id +
                "_qty' in entity.attributes) return `${entity.attributes.list_" +
                this._config.shopping_list_id +
                "_qty}`; else return '0'; ]]]",
            },
          };
          if (this._config.confirmation) {
            const confirmation = JSON.parse(JSON.stringify(this._config.confirmation));
            this.findAndReplace(confirmation, '[PRODUCT_ID]', entity.entity_id);
            cardConfig = {
              ...{ confirmation: confirmation },
              ...cardConfig,
            };
          }
          location_cards.push(cardConfig);
        });
        const entityCardConfig = {
          type: 'custom:collapsable-cards',
          title: location,
          defaultOpen: default_open,
          cards: [
            {
              type: 'vertical-stack',
              cards: location_cards,
            },
          ],
        };
        entities.push(entityCardConfig);
        default_open = false;
      });
    } else if (this._config.hasOwnProperty('display_as_poster') && this._config.display_as_poster) {
      const productCards = [];
      Object.values(productArray).map((value) => {
        const entity = value[1] as ProductConfig;
        const tap_action = JSON.parse(JSON.stringify(this._config.tap_action));
        this.findAndReplace(tap_action, '[PRODUCT_ID]', entity.entity_id);
        const hold_action = JSON.parse(JSON.stringify(this._config.hold_action));
        this.findAndReplace(hold_action, '[PRODUCT_ID]', entity.entity_id);
        const double_tap_action = JSON.parse(JSON.stringify(this._config.double_tap_action));
        this.findAndReplace(double_tap_action, '[PRODUCT_ID]', entity.entity_id);
        let cardConfig = {
          type: 'custom:button-card',
          aspect_ratio: 4 / 3,
          show_icon: false,
          show_label: true,
          show_state: false,
          entity: entity.entity_id,
          tap_action: tap_action,
          hold_action: hold_action,
          double_tap_action: double_tap_action,
          label: entity.attributes?.location,
          extra_styles: `
            :host #container.vertical.no-icon.no-state {
              grid-template-rows: 1fr min-content;
              grid-template-areas:
                "n"
                "l";
              grid-template-columns: 1fr;
            }
            :host .ellipsis {
              white-space: normal
            }
          `,
          styles: {
            label: [{ 'z-index': 1 }, { 'font-size': 'small' }, { 'margin-top': '1vh' }],
            card: [
              {
                'background-image': 'url("data:image/jpg;base64,' + entity.attributes?.product_image + '")',
              },
              { 'background-repeat': 'no-repeat' },
              { 'background-position': 'center' },
              { 'background-size': 'contain' },
              {
                'border-width': entity.attributes.product_image ? '0' : 'var(--ha-card-border-width, 1px)',
              },
            ],
            name: [
              { 'z-index': 1 },
              { 'font-weight': 'bold' },
              { overflow: 'hidden' },
              { 'text-overflow': 'ellipsis' },
              { display: "'-webkit-box'" },
              { "'-webkit-line-clamp'": 2 },
              { 'line-clamp': 2 },
              { "'-webkit-box-orient'": 'vertical' },
            ],
            custom_fields: {
              gradient: [
                { display: entity.attributes.product_image ? 'block' : 'none' },
                { height: entity.attributes.product_image ? '100%' : '0px' },
                { width: entity.attributes.product_image ? '100%' : '0px' },
                {
                  'font-size': entity.attributes.product_image ? 'auto' : '0px',
                },
                {
                  'line-height': entity.attributes.product_image ? 'auto' : '0px',
                },
                {
                  'background-image':
                    "[[[ if ('list_" +
                    this._config.shopping_list_id +
                    "_note' in entity.attributes && entity.attributes.list_" +
                    this._config.shopping_list_id +
                    "_note == 'out_of_stock') return 'linear-gradient(180deg, hsla(352.94, 100%, 50%, 0.4) 0%, hsla(352.94, 100%, 49.68%, 0.401) 8.1%, hsla(352.94, 100%, 48.77%, 0.402) 15.5%, hsla(352.94, 100%, 47.33%, 0.405) 22.5%, hsla(352.94, 100%, 45.4%, 0.409) 29%, hsla(352.94, 100%, 43.03%, 0.413) 35.3%, hsla(352.94, 100%, 40.25%, 0.418) 41.2%, hsla(352.94, 100%, 37.08%, 0.423) 47.1%, hsla(352.94, 100%, 33.54%, 0.427) 52.9%, hsla(352.94, 100%, 29.66%, 0.432) 58.8%, hsla(352.94, 100%, 25.46%, 0.437) 64.7%, hsla(352.94, 100%, 20.94%, 0.441) 71%, hsla(352.94, 100%, 16.12%, 0.445) 77.5%, hsla(352.94, 100%, 11.02%, 0.448) 84.5%, hsla(352.94, 100%, 5.64%, 0.449) 91.9%, hsla(0, 0%, 0%, 0.45) 100%)'; else return 'linear-gradient(0deg, hsla(0, 0%, 0%, 0.8) 0%, hsla(0, 0%, 0%, 0.79) 8.3%, hsla(0, 0%, 0%, 0.761) 16.3%, hsla(0, 0%, 0%, 0.717) 24.1%, hsla(0, 0%, 0%, 0.66) 31.7%, hsla(0, 0%, 0%, 0.593) 39%, hsla(0, 0%, 0%, 0.518) 46.1%, hsla(0, 0%, 0%, 0.44) 53%, hsla(0, 0%, 0%, 0.36) 59.7%, hsla(0, 0%, 0%, 0.282) 66.1%, hsla(0, 0%, 0%, 0.207) 72.3%, hsla(0, 0%, 0%, 0.14) 78.3%, hsla(0, 0%, 0%, 0.083) 84%, hsla(0, 0%, 0%, 0.039) 89.6%, hsla(0, 0%, 0%, 0.01) 94.9%, hsla(0, 0%, 0%, 0) 100%)'; ]]]",
                },
                { position: 'absolute' },
                { top: '0' },
                { left: '0' },
                { 'z-index': '0' },
              ],
              qty_in_list: [
                { 'background-color': 'green' },
                { 'border-radius': '50%' },
                { position: 'absolute' },
                { right: '5%' },
                { top: '5%' },
                {
                  height: "[[[ if (entity.state > 0) return '20px'; else return '0px'; ]]]",
                },
                {
                  width: "[[[ if (entity.state > 0) return '20px'; else return '0px'; ]]]",
                },
                {
                  'font-size': "[[[ if (entity.state > 0) return '14px'; else return '0px'; ]]]",
                },
                {
                  'line-height': "[[[ if (entity.state > 0) return '20px'; else return '0px'; ]]]",
                },
              ],
            },
          },
          custom_fields: {
            gradient: '&nbsp;',
            qty_in_list:
              "[[[ if ('list_" +
              this._config.shopping_list_id +
              "_qty' in entity.attributes) return `${entity.attributes.list_" +
              this._config.shopping_list_id +
              "_qty}`; else return '0'; ]]]",
          },
        };
        if (this._config.confirmation) {
          const confirmation = JSON.parse(JSON.stringify(this._config.confirmation));
          this.findAndReplace(confirmation, '[PRODUCT_ID]', entity.entity_id);
          cardConfig = {
            ...{ confirmation: confirmation },
            ...cardConfig,
          };
        }
        productCards.push(cardConfig);
      });
      const entityCardConfig = {
        type: 'custom:layout-card',
        layout_type: 'grid',
        layout_options: {
          'grid-template-columns': '20% 20% 20% 20% 20%',
          mediaquery: {
            '(max-width: 600px)': {
              'grid-template-columns': '50% 50%',
            },
            '(max-width: 800px)': {
              'grid-template-columns': '25% 25% 25% 25%',
            },
          },
        },
        cards: productCards,
      };
      entities.push(entityCardConfig);
    } else {
      const productCards = [];
      Object.values(productArray).map((value) => {
        const entity = value[1] as ProductConfig;
        const tap_action = JSON.parse(JSON.stringify(this._config.tap_action));
        this.findAndReplace(tap_action, '[PRODUCT_ID]', entity.entity_id);
        const hold_action = JSON.parse(JSON.stringify(this._config.hold_action));
        this.findAndReplace(hold_action, '[PRODUCT_ID]', entity.entity_id);
        const double_tap_action = JSON.parse(JSON.stringify(this._config.double_tap_action));
        this.findAndReplace(double_tap_action, '[PRODUCT_ID]', entity.entity_id);
        let cardConfig = {
          type: 'custom:button-card',
          show_icon: false,
          entity: entity.entity_id,
          tap_action: tap_action,
          hold_action: hold_action,
          double_tap_action: double_tap_action,
          styles: {
            grid: [
              { 'grid-template-rows': '1fr' },
              { 'grid-template-areas': "'n qty_in_list'" },
              { 'grid-template-columns': '1fr min-content' },
            ],
            card: [
              { padding: '2% 4%' },
              {
                'background-color':
                  "[[[ if ('list_" +
                  this._config.shopping_list_id +
                  "_note' in entity.attributes && entity.attributes.list_" +
                  this._config.shopping_list_id +
                  "_note == 'out_of_stock') return 'red'; else return 'var( --ha-card-background, var(--card-background-color, white) )'; ]]]",
              },
            ],
            name: [{ 'align-self': 'center' }, { 'text-align': 'left' }, { width: '100%' }],
            custom_fields: {
              qty_in_list: [{ 'align-self': 'center' }, { 'justify-self': 'start' }, { 'padding-left': '8px' }],
            },
          },
          custom_fields: {
            qty_in_list:
              "[[[ if ('list_" +
              this._config.shopping_list_id +
              "_qty' in entity.attributes) return `${entity.attributes.list_" +
              this._config.shopping_list_id +
              "_qty}`; else return '0'; ]]]",
          },
        };
        if (this._config.confirmation) {
          const confirmation = JSON.parse(JSON.stringify(this._config.confirmation));
          this.findAndReplace(confirmation, '[PRODUCT_ID]', entity.entity_id);
          cardConfig = {
            ...{ confirmation: confirmation },
            ...cardConfig,
          };
        }
        productCards.push(cardConfig);
      });
      const entityCardConfig = {
        type: 'vertical-stack',
        cards: productCards,
      };
      entities.push(entityCardConfig);
    }

    return entities;
  }

  async update_card(entities: EntityList) {
    if (this._entities && compare_deep(entities, this._entities)) return;
    this._cardsEntities = [];
    this._entities = entities;
    const cardConfig = {
      ['cards']: entities,
      ...{ type: 'vertical-stack' },
    };
    if (!this.card) {
      const helpers = await (window as any).loadCardHelpers();
      this.card = await helpers.createCardElement(cardConfig);
    } else {
      this.card.setConfig(cardConfig);
    }

    this._cardBuiltResolve?.();
    this.card.hass = this.hass;
    if ((this.card as any).requestUpdate) {
      await this.updateComplete;
      (this.card as any).requestUpdate();
    }
  }

  async updated(changedProperties) {
    if (changedProperties.has('_template') || (changedProperties.has('hass') && this.hass)) {
      queueMicrotask(() => this.update_all());
    }
  }

  createRenderRoot() {
    return this;
  }
  render() {
    if (this._missingDeps?.length) {
      return slwgRenderDepsErrorCard(this._missingDeps);
    }
    
    return html`${this.card}`;
  }

  async getCardSize() {
    let len = 0;
    await this._cardBuilt;
    if (this.card && this.card.getCardSize) len = await this.card.getCardSize();
    if (len === 1 && this._entities?.length) len = this._entities.length;
    return len || 5;
  }

  static get styles() {
    return css`
      :host .ellipsis {
        white-space: normal;
      }
    `;
  }
}
customElements.define('slwg-product-card', ShoppingListWithGrocyProductCard);

window.customCards = window.customCards || []; // Create the list if it doesn't exist. Careful not to overwrite it
window.customCards.push({
  type: 'slwg-product-card',
  name: 'ShoppingListWithGrocy - Products',
  description: 'A way to display products from ShoppingListWithGrocy integration',
});
