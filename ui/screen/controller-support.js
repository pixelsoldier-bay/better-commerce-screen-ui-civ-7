/**
 * Routes Civ VII's controller/keyboard accept action to a focused control added by this mod.
 * It lives in screen because it only runs while Commerce is open and uses the UI focus service.
 * ⚠️ The handler consumes `accept` only when focus is on one of our marked controls.
 * A reference count keeps an older screen's delayed cleanup from stopping a reopened screen.
 */
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import { InputEngineEventName } from '/core/ui/input/input-support.js';

let screenCount = 0;

function onEngineInput(event) {
    if (event.detail?.name !== 'accept') {
        return;
    }

    let focused;
    try {
        focused = FocusManager.get().currentFocus();
    } catch (_error) {
        return;
    }

    if (!(focused instanceof HTMLElement)
        || focused.getAttribute('data-najane-controller-activatable') !== 'true'
        || !focused.isConnected) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focused.dispatchEvent(new CustomEvent('najane-controller-activate'));
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
    window.removeEventListener(InputEngineEventName, onEngineInput, true);
}
