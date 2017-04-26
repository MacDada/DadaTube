console.log('DadaTube: userscript.js loaded');

$(function () {
    'use strict';

    console.log('DadaTube: userscript.js ready');

    function convertToBoolean(value) {
        return !!value;
    }

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

        console.log('DadaTube: added css', css);
    }

    function makeCss(selector, rules) {
        var rulesCss = $.map(rules, function (value, key) {
            return key + ': ' + value;
        }).join('; ');

        return selector + '{' + rulesCss + '}';
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
                hidablesStorage.remove(identifyHidable($(this)));
            });

            hidableView.show($hidables);
        },
        hide: function ($hidables) {
            $hidables.each(function () {
                hidablesStorage.add(identifyHidable($(this)));
            });

            hidableView.hide($hidables);
        },
        /**
         * @param {jQuery} $hidable
         */
        toggleVisibility: function ($hidable) {
            if ($hidable.hasClass(hiddenClass)) {
                hidablesController.show($hidable);
            } else {
                hidablesController.hide($hidable);
            }
        }
    };

    var HidablesStorage = function (prefix) {
        this.has = function (id, callback) {
            if (!id) {
                throw 'DadaTube: HidablesStorage: id must not be empty';
            }

            var storageKey = prefix + id;

            ldb.get(storageKey, function (value) {
                console.log('DadaTube: HidablesStorage.get', storageKey, value);

                callback(convertToBoolean(value));
            });
        };

        this.add = function (id) {
            console.log('DadaTube: HidablesStorage.add(' + id + ') called');

            var storageKey = prefix + id;

            ldb.set(storageKey, (new Date()).toJSON());

            ldb.get(storageKey, function (value) {
                console.log('DadaTube: value for "' + storageKey + '" was set: "' + value + '"');
            });
        };

        this.remove = function (id) {
            this.has(id, function (has) {
                if (has) {
                    ldb.set(prefix + id, null);
                }
            });
        };
    };

    /**
     * @param {jQuery} $items
     * @param {function} filterCallback
     * @param {function} returnCallback
     */
    function jQueryLazyFilter($items, filterCallback, returnCallback) {
        var $itemsToKeep = $();

        var itemsLength = $items.length;
        var itemsProcessed = 0;

        $items.each(function (index, item) {
            var $item = $(item);

            filterCallback($item, function (shouldBeKeptInResult) {
                itemsProcessed++;

                if (shouldBeKeptInResult) {
                    $itemsToKeep = $itemsToKeep.add($item);
                }

                if (itemsProcessed === itemsLength) {
                    returnCallback($itemsToKeep);
                }
            });
        });
    }

    /**
     * @param {HidablesStorage} hidablesStorage
     * @param {function} callback
     */
    function selectHidablesFromStorage(hidablesStorage, callback) {
        jQueryLazyFilter(
            $hidables,
            function filterCallback($hidable, callback) {
                hidablesStorage.has(identifyHidable($hidable), callback);
            },
            callback
        );
    }

    /**
     * Gets hidable identifying data
     */
    function identifyHidable($hidable) {
        var $onSingleVideoRelated = $hidable.find('a.thumb-link');

        if (1 === $onSingleVideoRelated.length) {
            return $onSingleVideoRelated
                .attr('href')
                .match('/watch\\?v=(.*)')[1];
        }

        var $onHomepage = $hidable.find('a.yt-uix-sessionlink:first');

        if (1 === $onHomepage.length) {
            return $onHomepage
                .attr('href')
                .match('/watch\\?v=(.*)')[1];
        }

        throw {
            'message': 'Could not identify hidable',
            '$hidable': $hidable,
            '$onSingleVideoRelated': $onSingleVideoRelated,
            '$onHomepage': $onHomepage
        };
    }

    function hideItemsInStorage(hidablesStorage, hidableView) {
        selectHidablesFromStorage(hidablesStorage, function ($found) {
            console.log('DadaTube: found to remove on start', $found);

            hidableView.hide($found);

            $found.each(function () {
                var $hidable = $(this);

                console.log('DadaTube: hiding on start', identifyHidable($hidable));

                hidableView.hide($hidable);
                // $found.remove();
            });
        });
    }

    var options = {
        hiddenOpacity: 0.3
    };

    var hiddenClass = 'dnthHidden';

    addGlobalStyle(makeCss('.' + hiddenClass, {
        border: '1px solid red',
        // opacity: options.hiddenOpacity,
        transition: 'opacity 0.2s ease-in-out'
    }));

    /**
     * Hidables IDs storage helper.
     * Keys have prefix to avoid collisions and easily find items.
     * Keys hold hidable IDs, values have the date they were hidden.
     */
    var hidablesStorage = new HidablesStorage('dnthHiddenHidable_');

    /**
     * Items to hide
     */
    var $hidables = $();

    // right column on single video page
    $hidables = $hidables.add('.related-list-item');

    // homepage
    $hidables = $hidables.add('.yt-lockup-video');

    if (0 === $hidables.length) {
        console.log('DadaTube: no hidables found on start');
    } else {
        $hidables.each(function () {
            console.log('DadaTube: hidable on start', identifyHidable($(this)));
        });
    }

    // make all hidables visible for debug
    // $hidables.css('opacity', '0.2');

    /**
     * Clicking on a table row (hidable), hides it.
     */
    $hidables.click(function () {
        console.log('DadaTube: hidable clicked');

        hidablesController.toggleVisibility($(this));
    });

    /**
     * Page loaded: removing elements already hidden and saved to localStorage
     */
    hideItemsInStorage(hidablesStorage, hidableView);

    $('<button>hide all and close</button>')
        .addClass('yt-uix-button yt-uix-button-size-default yt-uix-button-expander')
        .insertAfter('#watch-more-related-button')
        .click(function () {
            hidablesController.hideAll();

            window.close();
        });

    /**
     * When switched from other window/tab,
     * we hide items that could have been hidden on other windows/tabs.
     */
    $(window).on('focus', function () {
        hideItemsInStorage(hidablesStorage, hidableView);
    });
});
