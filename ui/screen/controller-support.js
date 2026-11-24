/**
 * Routes Civ VII's controller accept action to mod controls across the Commerce screen and HUD.
 * Only explicit nested scopes enter a mod control group; vanilla navigation rules are not changed.
 */
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import { Focus } from '/core/ui/input/focus-support.js';
import { InputEngineEventName } from '/core/ui/input/input-support.js';
import { Navigation } from '/core/ui/input/navigation-support.js';

import { BUY_STACK_CLASS } from './trade-buy-merchant.js';
import { TRADE_CARD_SELECTOR } from './screen-parts.js';
import { warn } from '../support/diagnostics.js';

const SETTLEMENT_CARD_SELECTOR = '[data-name$="-city-resource-activatable"]';
const SETTLEMENT_ACTIONS_SELECTOR = '.najane-card-actions';

let started = false;
let activeScope = null;

function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function firstControlIn(container) {
    for (const control of container.querySelectorAll('[data-najane-controller-activatable][tabindex]')) {
        if (Navigation.isFocusable(control)) {
            return control;
        }
    }
    return null;
}

function controllerScopeFor(focused) {
    if (focused.matches(TRADE_CARD_SELECTOR)) {
        const stack = focused.querySelector(`.${BUY_STACK_CLASS}`);
        return stack ? { container: focused, controls: stack } : null;
    }
    if (focused.matches(SETTLEMENT_CARD_SELECTOR)) {
        const actions = focused.querySelector(SETTLEMENT_ACTIONS_SELECTOR);
        return actions ? { container: focused, controls: actions } : null;
    }
    return null;
}

function isCancelInput(event) {
    try {
        return event.isCancelInput?.() === true
            || event.detail?.isCancelInput?.() === true
            || event.detail?.name === 'cancel';
    } catch (_error) {
        return event.detail?.name === 'cancel';
    }
}

function onEngineInput(event) {
    let focused;
    try {
        focused = FocusManager.get().currentFocus();
    } catch (_error) {
        return;
    }

    if (!(focused instanceof HTMLElement) || !focused.isConnected) {
        return;
    }

    if (event.detail?.name === 'accept') {
        if (focused.getAttribute('data-najane-controller-activatable') === 'true') {
            swallow(event);
            focused.dispatchEvent(new CustomEvent('najane-controller-activate'));
            return;
        }

        // Native focus boundaries hide descendants from sibling navigation. These two scopes
        // get a local entry point so their controls precede the existing resource navigation.
        const scope = controllerScopeFor(focused);
        if (!scope) {
            return;
        }
        let firstControl;
        try {
            firstControl = firstControlIn(scope.controls);
        } catch (error) {
            warn(`could not find a focusable control in a Commerce card: ${error}`);
            return;
        }
        if (!firstControl) {
            return;
        }
        try {
            activeScope = scope.container;
            Focus.setContextAwareFocus(firstControl, scope.container);
            swallow(event);
        } catch (error) {
            activeScope = null;
            warn(`could not enter a Commerce card's mod controls: ${error}`);
        }
        return;
    }

    if (!isCancelInput(event)) {
        return;
    }

    // A controller-opened picker is one level inside the card group: B closes it first.
    const openMenu = focused.closest('[data-najane-controller-menu="true"]');
    if (openMenu) {
        swallow(event);
        openMenu.dispatchEvent(new CustomEvent('najane-controller-cancel', { bubbles: true }));
        return;
    }

    if (!activeScope?.isConnected || focused === activeScope || !activeScope.contains(focused)) {
        activeScope = null;
        return;
    }

    try {
        FocusManager.get().setFocus(activeScope);
        activeScope = null;
        swallow(event);
    } catch (error) {
        warn(`could not return focus to the Commerce card: ${error}`);
    }
}

export function startControllerSupport() {
    if (started) {
        return;
    }
    started = true;
    window.addEventListener(InputEngineEventName, onEngineInput, true);
}
