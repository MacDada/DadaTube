console.log('DadaTube: userscript.js loaded');

$(function () {
    'use strict';

    console.log('DadaTube: userscript.js ready');

    const config = window.dadaTubeConfig;

    const itemsFromRightColumnSelector = '.related-list-item';
    const itemsFromHomeAndSubscriptionsPagesSelector = '.yt-lockup-video';

    const itemsSelector = [
        itemsFromRightColumnSelector,
        itemsFromHomeAndSubscriptionsPagesSelector
    ].join(',');

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('DadaTube:');

        console.log.apply(console, args);
    }

    function convertToBoolean(value) {
        return !!value;
    }

    function stringContains(string, contains) {
        return -1 !== string.indexOf(contains);
    }

    /**
     * @param {string} string
     * @param {string} start
     * @returns string
     */
    function stringRemoveEndStartingWith(string, start)
    {
        return stringContains(string, start)
            ? string.substring(0, string.indexOf(start))
            : string;
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

        log('added css', css);
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

            const storageKey = prefix + id;

            ldb.get(storageKey, function (value) {
                log('HidablesStorage.get', storageKey, value);

                callback(convertToBoolean(value));
            });
        };

        this.add = function (id) {
            log('HidablesStorage.add(' + id + ') called');

            const storageKey = prefix + id;

            ldb.set(storageKey, (new Date()).toJSON());

            ldb.get(storageKey, function (value) {
                log('value for "' + storageKey + '" was set: "' + value + '"');
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
        const itemsLength = $items.length;

        var $itemsToKeep = $();
        var itemsProcessed = 0;

        $items.each(function (index, item) {
            const $item = $(item);

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
     * @param {jQuery} $hidables
     * @param {function} callback
     */
    function selectHidablesFromStorage(hidablesStorage, $hidables, callback) {
        jQueryLazyFilter(
            $hidables,
            function filterCallback($hidable, callback) {
                hidablesStorage.has(identifyHidable($hidable), callback);
            },
            callback
        );
    }

    function IdentifiedPlaylistException(id) {
        this.message = 'Could not identify hidable: it is a playlist';
        this.id = id;
    }

    /**
     * Gets hidable identifying data
     */
    function identifyHidable($hidable) {
        function extractVideoIdFromLink($link) {
            const id = $link
                .attr('href')
                .match('/watch\\?v=(.*)')[1];

            if (stringContains(id, '&list=')) {
                throw new IdentifiedPlaylistException(id);
            }

            return stringRemoveEndStartingWith(id, '&t=');
        }

        const $onSingleVideoRelated = $hidable.find('a.thumb-link');

        if (1 === $onSingleVideoRelated.length) {
            return extractVideoIdFromLink($onSingleVideoRelated)
        }

        const $onHomepage = $hidable.find('a.yt-uix-sessionlink:first');

        if (1 === $onHomepage.length) {
            return extractVideoIdFromLink($onHomepage);
        }

        throw {
            'message': 'Could not identify hidable',
            '$hidable': $hidable,
            '$onSingleVideoRelated': $onSingleVideoRelated,
            '$onHomepage': $onHomepage
        };
    }

    function hideItemsInStorage(hidablesStorage, hidableView, $hidables) {
        selectHidablesFromStorage(hidablesStorage, $hidables, function ($found) {
            log('found to hide from storage', $found);

            hidableView.hide($found);

            $found.each(function () {
                const $hidable = $(this);

                log('hiding from storage', identifyHidable($hidable));

                hidableView.hide($hidable);
                // $found.remove();
            });
        });
    }

    function isItemHidable($item) {
        try {
            identifyHidable($item);
        } catch (error) {
            if (error instanceof IdentifiedPlaylistException) {
                log('skipping playlist', error);

                return false;
            }

            throw error;
        }

        return true;
    }

    const hiddenClass = 'dnthHidden';

    addGlobalStyle(makeCss('.' + hiddenClass, {
        border: '1px solid red',
        transition: 'opacity 0.2s ease-in-out'
    }));

    /**
     * Hidables IDs storage helper.
     * Keys have prefix to avoid collisions and easily find items.
     * Keys hold hidable IDs, values have the date they were hidden.
     */
    const hidablesStorage = new HidablesStorage('dnthHiddenHidable_');

    /**
     * Items to hide
     */
    var $hidables = $();

    $('body').livequery(itemsSelector, function () {
        log('new item was added to the page');

        const $hidable = $(this);

        if (!isItemHidable($hidable)) {
            return;
        }

        $hidables = $hidables.add($hidable);

        log('found new hidable', identifyHidable($(this)));

        if (config.debug) {
            // make all hidables visible
            $hidable.css('opacity', '0.5');
        }

        /**
         * Clicking on a table row (hidable), hides it.
         */
        $hidable.click(function () {
            log('hidable clicked');

            hidablesController.toggleVisibility($(this));
        });

        /**
         * removing elements already hidden and saved to localStorage
         */
        hideItemsInStorage(hidablesStorage, hidableView, $hidable);
    });

    /**
     * When switched from other window/tab,
     * we hide items that could have been hidden on other windows/tabs.
     */
    $(window).on('visibilitychange', function () {
        if (!document.hidden) {
            log('hiding on window being visible (i.e. tab viewed again)');

            hideItemsInStorage(hidablesStorage, hidableView, $hidables);
        }
    });
});
