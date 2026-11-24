/**
 * Routes Civ VII's controller/keyboard accept action to a focused control added by this mod.
 * It lives in screen because it only runs while Commerce is open and uses the UI focus service.
 * ⚠️ The handler consumes `accept` only when focus is on one of our marked controls.
 * A reference count keeps an older screen's delayed cleanup from stopping a reopened screen.
 */
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import { InputEngineEventName } from '/core/ui/input/input-support.js';
import { Navigation } from '/core/ui/input/navigation-support.js';

import { BUY_STACK_CLASS } from './trade-buy-merchant.js';
import { TRADE_CARD_SELECTOR } from './screen-parts.js';
import { warn } from '../support/diagnostics.js';

let screenCount = 0;
let activeRouteCard = null;

function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function firstBuyControl(card) {
    const stack = card.querySelector(`.${BUY_STACK_CLASS}`);
    if (!stack) {
        return null;
    }
    for (const control of stack.querySelectorAll('[data-najane-controller-activatable][tabindex]')) {
        if (Navigation.isFocusable(control)) {
            return control;
        }
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

        // Cards are focus boundaries in Civ VII's Navigation tree. Enter only this card's
        // mod action stack; ordinary cards and all other focus targets keep native behavior.
        if (focused.matches(TRADE_CARD_SELECTOR)) {
            let firstControl;
            try {
                firstControl = firstBuyControl(focused);
            } catch (error) {
                warn(`could not find a focusable trade-card control: ${error}`);
                return;
            }
            if (!firstControl) {
                return;
            }
            try {
                FocusManager.get().setFocus(firstControl);
                activeRouteCard = focused;
                swallow(event);
            } catch (error) {
                warn(`could not enter the trade card's mod controls: ${error}`);
            }
        }
        return;
    }

    if (!isCancelInput(event) || !activeRouteCard?.isConnected
        || focused === activeRouteCard || !activeRouteCard.contains(focused)) {
        return;
    }

    try {
        FocusManager.get().setFocus(activeRouteCard);
        activeRouteCard = null;
        swallow(event);
    } catch (error) {
        warn(`could not return focus to the trade card: ${error}`);
    }
}

export function startControllerSupport() {
    screenCount++;
    if (screenCount > 1) {
        return;
    }
    window.addEventListener(InputEngineEventName, onEngineInput, true);
}

export function stopControllerSupport() {
    if (screenCount === 0) {
        return;
    }
    screenCount--;
    if (screenCount > 0) {
        return;
    }
    activeRouteCard = null;
    window.removeEventListener(InputEngineEventName, onEngineInput, true);
}
