/*!
 * jQuery UI Touch Punch (Modernized) 1.0.0
 * 
 * Based on jQuery UI Touch Punch 0.2.3 by Dave Furfero
 * Copyright 2011–2014, Dave Furfero
 * Modernization © 2025, contributors
 *
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Depends:
 *  jquery.ui.widget.js
 *  jquery.ui.mouse.js
 */
(function ($)
{
    if (!$.ui || !$.ui.mouse)
    {
        // jQuery UI Mouse plugin is required
        return;
    }

    var mouseProto = $.ui.mouse.prototype;
    var _mouseInit = mouseProto._mouseInit;
    var _mouseDestroy = mouseProto._mouseDestroy;

    // Feature detection
    var hasPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
    var hasTouch = (function ()
    {
        if (hasPointer)
        {
            return true;
        }

        // Classic touch events
        return typeof window !== 'undefined' && ('ontouchstart' in window || (window.DocumentTouch && document instanceof window.DocumentTouch));
    }());

    // If there is no touch-like input, do nothing
    if (!hasTouch)
    {
        return;
    }

    // Track whether a touch interaction is currently being handled by a widget
    var touchHandled = false;

    // Utility: create & dispatch a MouseEvent from a touch/pointer event
    function simulateMouseEvent(event, simulatedType)
    {
        var orig = event.originalEvent || event;
        var point;

        // Ignore multi-touch for classic touch events
        if (orig.touches && orig.touches.length > 1)
        {
            return;
        }

        // Use coordinates from pointer or touch
        if (orig.changedTouches && orig.changedTouches.length)
        {
            point = orig.changedTouches[0];
        }
        else
        {
            point = orig;
        }

        // Prevent native scrolling/selection during active gestures
        // (must be passive:false on listeners; see bindings below)
        if (typeof event.preventDefault === 'function')
        {
            event.preventDefault();
        }

        var opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 1,
            screenX: point.screenX || 0,
            screenY: point.screenY || 0,
            clientX: point.clientX || 0,
            clientY: point.clientY || 0,
            ctrlKey: !!event.ctrlKey,
            altKey: !!event.altKey,
            shiftKey: !!event.shiftKey,
            metaKey: !!event.metaKey,
            button: 0,
            relatedTarget: null
        };

        var simulatedEvent;

        try
        {
            simulatedEvent = new MouseEvent(simulatedType, opts);
        }
        catch (e)
        {
            // Fallback for very old browsers
            simulatedEvent = document.createEvent('MouseEvents');
            simulatedEvent.initMouseEvent(
                simulatedType,
                true,
                true,
                window,
                1,
                opts.screenX,
                opts.screenY,
                opts.clientX,
                opts.clientY,
                opts.ctrlKey,
                opts.altKey,
                opts.shiftKey,
                opts.metaKey,
                opts.button,
                opts.relatedTarget
            );
        }

        (event.target || event.srcElement).dispatchEvent(simulatedEvent);
    }

    // Touch start handler
    mouseProto._touchStart = function (event)
    {
        var self = this;
        var orig = event.originalEvent || event;

        // Filter pointer events to touch only
        if (hasPointer && orig.pointerType && orig.pointerType !== 'touch')
        {
            return;
        }

        // If another widget is already handling, ignore
        // Also require mouse capture to succeed for this target
        if (touchHandled || !self._mouseCapture(hasPointer ? orig : (orig.changedTouches ? orig.changedTouches[0] : orig)))
        {
            return;
        }

        touchHandled = true;
        self._touchMoved = false;

        simulateMouseEvent(event, 'mouseover');
        simulateMouseEvent(event, 'mousemove');
        simulateMouseEvent(event, 'mousedown');
    };

    // Touch move handler
    mouseProto._touchMove = function (event)
    {
        if (!touchHandled)
        {
            return;
        }

        this._touchMoved = true;
        simulateMouseEvent(event, 'mousemove');
    };

    // Touch end handler
    mouseProto._touchEnd = function (event)
    {
        if (!touchHandled)
        {
            return;
        }

        simulateMouseEvent(event, 'mouseup');
        simulateMouseEvent(event, 'mouseout');

        if (!this._touchMoved)
        {
            simulateMouseEvent(event, 'click');
        }

        touchHandled = false;
    };

    // Hook into the mouse plugin init to bind our touch/pointer listeners
    mouseProto._mouseInit = function ()
    {
        var self = this;
        var ns = '.touchpunch';
        var $el = self.element;

        // We need passive:false to be able to call preventDefault() in handlers.
        // jQuery's .on() cannot set passive, so bind with addEventListener on the raw element.
        var el = $el.get(0);

        // Keep bound refs so we can remove them later
        function bindRaw(type, handler)
        {
            // Use capture=false, passive=false
            el.addEventListener(type, handler, { capture: false, passive: false });
        }

        function unbindRaw(type, handler)
        {
            el.removeEventListener(type, handler, { capture: false });
        }

        // Wrap jQuery handlers to maintain `this` = widget instance
        var onStart = function (e)
        {
            return self._touchStart(e);
        };
        var onMove = function (e)
        {
            return self._touchMove(e);
        };
        var onEnd = function (e)
        {
            return self._touchEnd(e);
        };

        // Store them on the instance for destroy-time cleanup
        self._tpHandlers = {
            onStart: onStart,
            onMove: onMove,
            onEnd: onEnd,
            bindRaw: bindRaw,
            unbindRaw: unbindRaw,
            ns: ns
        };

        if (hasPointer)
        {
            // Pointer Events (filter to touch inside handlers)
            bindRaw('pointerdown', onStart);
            bindRaw('pointermove', onMove);
            bindRaw('pointerup', onEnd);
            bindRaw('pointercancel', onEnd);
            // Also stop native gestures from scrolling container while dragging
            // (done via preventDefault in simulateMouseEvent)
        }
        else
        {
            // Classic Touch Events
            bindRaw('touchstart', onStart);
            bindRaw('touchmove', onMove);
            bindRaw('touchend', onEnd);
            bindRaw('touchcancel', onEnd);
        }

        // Call the original mouse init
        _mouseInit.call(self);
    };

    // Unbind on destroy
    mouseProto._mouseDestroy = function ()
    {
        var self = this;
        var h = self._tpHandlers;

        if (h && h.unbindRaw)
        {
            if (hasPointer)
            {
                h.unbindRaw('pointerdown', h.onStart);
                h.unbindRaw('pointermove', h.onMove);
                h.unbindRaw('pointerup', h.onEnd);
                h.unbindRaw('pointercancel', h.onEnd);
            }
            else
            {
                h.unbindRaw('touchstart', h.onStart);
                h.unbindRaw('touchmove', h.onMove);
                h.unbindRaw('touchend', h.onEnd);
                h.unbindRaw('touchcancel', h.onEnd);
            }
        }

        self._tpHandlers = null;

        _mouseDestroy.call(self);
    };

}(jQuery));
