console.log('DadaTube: userscript.js loaded');

// https://github.com/DVLP/localStorageDB#you-can-use-it-as-a-one-liner-in-your-js-code
!function(){function e(t,o){return n?void(n.transaction("s").objectStore("s").get(t).onsuccess=function(e){var t=e.target.result&&e.target.result.v||null;o(t)}):void setTimeout(function(){e(t,o)},100)}var t=window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB;if(!t)return void console.error("indexDB not supported");var n,o={k:"",v:""},r=t.open("d2",1);r.onsuccess=function(e){n=this.result},r.onerror=function(e){console.error("indexedDB request error"),console.log(e)},r.onupgradeneeded=function(e){n=null;var t=e.target.result.createObjectStore("s",{keyPath:"k"});t.transaction.oncomplete=function(e){n=e.target.db}},window.ldb={get:e,set:function(e,t){o.k=e,o.v=t,n.transaction("s","readwrite").objectStore("s").put(o)}}}();

$(function () {
    'use strict';

    console.log('DadaTube: userscript.js ready');

    function addGlobalStyle(css) {
        var head, style;
        head = document.getElementsByTagName('head')[0];
        if (!head) {
            throw 'no head?!';
        }
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    }

    /**
     * Show/hide hidables in the view
     */
    var hidableView = {
        hide: function ($hidables, onComplete) {
            $hidables.addClass(hiddenClass);

            if (onComplete) {
                onComplete();
            }
        },
        show: function ($hidables, onComplete) {
            $hidables.removeClass(hiddenClass);

            if (onComplete) {
                onComplete();
            }
        }
    };

    var hidablesController = {
        showAll: function () {
            hidablesController.show($hidables);
        },
        hideAll: function () {
            hidablesController.hide($hidables);
        },
        show: function ($hidables) {
            $hidables.each(function () {
                hiddenHidablesStorage.remove(identifyHidable($(this)));
            });

            hidableView.show($hidables);
        },
        hide: function ($hidables) {
            $hidables.each(function () {
                hiddenHidablesStorage.add(identifyHidable($(this)));
            });

            hidableView.hide($hidables);
        },
        toggleVisibility: function ($hidable) {
            if ($hidable.hasClass(hiddenClass)) {
                hidablesController.show($hidable);
            } else {
                hidablesController.hide($hidable);
            }
        }
    };

    var HidablesStorage = function (storageDriver, prefix) {
        this.has = function (id, callback) {
            if (!id) {
                callback(false);
            }

            ldb.get(prefix + id, function (value) {
                console.log('HidablesStorage get', prefix + id, value);
                callback(value ? true : false);
            });
            // callback(storageDriver[prefix + id] ? true : false);
        };

        this.add = function (id) {
            console.log('HidablesStorage.add(' + id + ') called');

            ldb.set(prefix + id, (new Date()).toJSON());

            ldb.get(prefix + id, function (value) {
                console.log('value for "' + prefix + id + '" was set: "' + value + '"');
            });

            // storageDriver[prefix + id] = (new Date()).toJSON();
        };

        this.remove = function (id) {
            this.has(id, function (has) {
                if (has) {
                    ldb.set(prefix + id, null);
                    // storageDriver.removeItem(prefix + id);
                }
            });
        };
    }; // eo Storage

    function selectHidablesFromStorage(returnResultCallback) {
        var selectedIds = [];

        var hidablesLength = $hidables.length;
        var hidablesProcessed = 0;

        $hidables.each(function (index, value) {
            var id = identifyHidable($(value));

            hiddenHidablesStorage.has(id, function (has) {
                hidablesProcessed++;

                if (has) {
                    selectedIds.push(id);
                }

                if (hidablesProcessed === hidablesLength) {
                    document.selectedIds = selectedIds;

                    document.hids = $hidables;

                    var $result = $hidables.filter(function () {
                        return !$.inArray(
                            identifyHidable($(this)),
                            selectedIds
                        );
                    });

                    returnResultCallback($result);
                }
            });
        });
    }

    var options = {
        hiddenOpacity: 0.3
    };

    var hiddenClass = 'dnthHidden';

    addGlobalStyle('.' + hiddenClass + ' { opacity: ' + options.hiddenOpacity + '; transition: opacity 0.2s ease-in-out; }');

    /**
     * Hidables IDs storage helper.
     * Keys have prefix to avoid collisions and easily find items.
     * Key hold hidable IDs, values have the date they were hidden.
     */
    var hiddenHidablesStorage = new HidablesStorage(localStorage, 'dnthHiddenHidable_');

    /**
     * Gets hidable identifying data
     */
    var identifyHidable = function ($hidable) {
        return $hidable
            .find('a.thumb-link')
            .attr('href')
            .match('/watch\\?v=(.*)')[1];
    };

    /**
     * Items to hide
     *
     * We look in related items on single video player page.
     * First item is a playlist, we skip it.
     */
    var $hidables = $('#watch-related')
        .find('.related-list-item:not(:first-child)');

    // $hidables.each(function () {
    //     console.log('hidable on start', identifyHidable($(this)));
    // });

    /**
     * Clicking on a table row (hidable), hides it.
     */
    $hidables.click(function () {
        console.log('hidable clicked');

        hidablesController.toggleVisibility($(this));
    });

    /**
     * Page loaded: removing elements already hidden and saved to localStorage
     */
    selectHidablesFromStorage(function ($found) {
        console.log('found to remove on start', $found);

        hidableView.hide($found);
        // $found.remove();
    });

    /**
     * Hide/remove from storage when space is hit
     */
    // var removedAfterSpace = false;
    // $(document).keydown(function (event) {
    //     if (32 == event.keyCode) {
    //         console.log('space was hit');
    //
    //         selectHidablesFromStorage(function ($found) {
    //             if (removedAfterSpace) {
    //                 hidableView.hide($found);
    //             } else {
    //                 hidableView.hide($found);
    //                 // $found.remove();
    //
    //                 removedAfterSpace = true;
    //             }
    //         });
    //     }
    // });

    $('<button>hide all and close</button>')
        .addClass('yt-uix-button yt-uix-button-size-default yt-uix-button-expander')
        .insertAfter('#watch-more-related-button')
        .click(function () {
            hidablesController.hideAll();

            window.close();
        });
});
