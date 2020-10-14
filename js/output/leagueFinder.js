if (document.domain.indexOf('littleleague.org') > -1) {
    document.domain = "littleleague.org";
}

var mapManager;
var geocoder;
var autocomplete;
var mapManagerInitialized = false;

function googleMapsReady() {
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('address-input'),
        {
            types: ['address']
        });
    autocomplete.setFields(['formatted_address']);
}

function onPlaceChanged() {
    var place = autocomplete.getPlace();
    console.info(place);
}

function initializeMapManagerAndGoogleApis() {
    if (!mapManagerInitialized) {
        var mmOpts = {

            //Google (mandatory)
            mapElementId: "map",

            //Google (optional)
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            defaultZoom: 4,
            defaultLatLng: { lat: 38.5, lng: -96 },

            //Esri (mandatory)
            portalBoundaryUrl: arcGISMapServerUrl
        };

        mapManager = new MapManager(mmOpts);
        mapManager.initialize();

        geocoder = new google.maps.Geocoder();

        mapManagerInitialized = true;
    }
}

function toggleSearchForm(show) {
    $('#address-search-form-row').toggle(show);

    if (show) {
        toggleLeagueLookupFailureMessage(false);
        toggleSearchSummary(false);
        toggleMapDisplay(false);
        toggleApproximateMatch(false);
        toggleNoResults(false);
        toggleMultipleResults(false);
        toggleContactForm(false);
        toggleContactFormSuccessMessage(false);
        toggleContactFormFailureMessage(false);
    }
}

function toggleGeocodingFailureMessage(show) {
    $('#geocoding-failure-message-row').toggle(show);
}

function toggleGeocodingPrecisionTooLowMessage(show) {
    $('#geocoding-precision-too-low-message-row').toggle(show);
}

function toggleLeagueLookupFailureMessage(show) {
    $('#league-lookup-failure-message-row').toggle(show);
}

function toggleSearchSummary(show) {
    $('#search-summary-wrapper-row').toggle(show);
}

function toggleMapDisplay(show) {
    $('#map-wrapper-row').toggle(show);
    toggleContactForm(show);

    if (show) {
        toggleSearchSummary(true);
        toggleSearchForm(false);
    }
}

function toggleApproximateMatch(show) {
    $('#approximate-match-row').toggle(show);
}

function toggleNoResults(show) {
    $('#no-results-row').toggle(show);
    toggleContactForm(show, true);

    if (show) {
        toggleSearchSummary(true);
        toggleSearchForm(false);
    }
}

function toggleMultipleResults(show) {
    $('#multiple-results-row').toggle(show);
    toggleContactForm(show, true);

    if (show) {
        toggleSearchSummary(true);
        toggleSearchForm(false);
    }
}

function toggleContactForm(show, contactLittleLeague) {
    $('#contact-form-row').toggle(show);

    var reasonForContactingDropdown = $('#contact-form select[name="contact-reason"]');
    reasonForContactingDropdown.empty();

    var reasonForContactingDropdownOptions = [];
    if (contactLittleLeague) {
        reasonForContactingDropdownOptions.push('I want to find a league');
        reasonForContactingDropdownOptions.push('I want to start a league');
        reasonForContactingDropdownOptions.push('I have questions about Little League');
    }
    else {
        reasonForContactingDropdownOptions.push('I want to register a child to play');
        reasonForContactingDropdownOptions.push('I would like more information');
        reasonForContactingDropdownOptions.push('I would like to volunteer');
        reasonForContactingDropdownOptions.push('I would like to support or donate');
    }
    reasonForContactingDropdown.append($.map(reasonForContactingDropdownOptions, function (x) { return $('<option>').text(x); }));

    toggleContactFormCommunicationPreferencesRow(false);
}

function toggleContactFormCommunicationPreferencesRow(show) {
    $('#contact-form-communications-preferences-row').toggle(show);
}

function toggleContactFormSuccessMessage(show) {
    $('#contact-form-success-row').toggle(show);
}

function toggleContactFormFailureMessage(show) {
    $('#contact-form-failure-row').toggle(show);
}

$(function () {
    if (parent.refreshLeagueFinderHeight) {
        var lastHeight = 0;
        setInterval(function () {
            var currentHeight = $('body').outerHeight();
            if (lastHeight !== currentHeight) {
                parent.refreshLeagueFinderHeight();
                lastHeight = currentHeight;
            }
        }, 100);
    }
});

// Address Search Form
$(function () {

    $('#address-search-form').validate({
        rules: {
            'sport-type-input': {
                required: true
            },
            'address-input': {
                required: true
            }
        },
        submitHandler: findLeague
    });

    $('#change-search-button').click(function () {
        toggleSearchForm(true);
        return false;
    });

    function findLeague() {
        initializeMapManagerAndGoogleApis();

        var searchAddress = $('#address-input').val();
        var sportCode = parseInt($('#sport-type-input').val());

        toggleSearchButtonSpinner(true);
        toggleGeocodingFailureMessage(false);
        toggleGeocodingPrecisionTooLowMessage(false);
        toggleLeagueLookupFailureMessage(false);

        geocodeAddress(searchAddress, function (geocodeResult) {
            var searchAddressSuccessfullyGeocoded = geocodeResult.success;
            var geocodeAccuracyLevel = geocodeResult.accuracyLevel;
            var latLng = geocodeResult.latLng;
            var formattedAddress = geocodeResult.formattedAddress;
            var addressCountry = geocodeResult.addressCountry;

            if (searchAddressSuccessfullyGeocoded) {
                // FB/GA tracking
                try {
                    fbq('trackCustom', 'Find A League');
                    goog_snippet_vars = function () {
                        var w = window;
                        w.google_conversion_id = 942821740;
                        w.google_conversion_label = "AymmCJ6G5HAQ7KLJwQM";
                        w.google_remarketing_only = false;
                    };
                    goog_report_conversion();
                } catch (err) {
                    //
                }

                if (geocodeAccuracyLevel === "ROOFTOP" || geocodeAccuracyLevel === "RANGE_INTERPOLATED" || (addressCountry && addressCountry !== 'US')) {

                    // Get the league IDs from the boundary mapping system
                    var getLeagueIdsDeferred = mapManager.getLeagueIds(latLng, sportCode);

                    // Log the search and pick the league to display
                    var logRequestAndFilterBoundaryMapOptionsDeferred = getLeagueIdsDeferred.then(function (results) {
                        return logRequestAndFilterBoundaryMapOptions(true, results);
                    }, handleGetLeagueIdsError);

                    // Display the league
                    var isRooftopMatch = geocodeAccuracyLevel === "ROOFTOP";
                    logRequestAndFilterBoundaryMapOptionsDeferred.then(function (result) {
                        updateMap(result, formattedAddress, isRooftopMatch);
                    }, handleLogRequestAndFilterBoundaryMapOptionsError);
                } else {
                    // Show geocoding precision too low message
                    logRequestAndFilterBoundaryMapOptions(false).then(function () {
                        toggleSearchButtonSpinner(false);
                        toggleGeocodingPrecisionTooLowMessage(true);
                    }, handleLogRequestAndFilterBoundaryMapOptionsError);
                }
            }
            else {
                // Show geocoding error message
                logRequestAndFilterBoundaryMapOptions(false).then(function () {
                    toggleSearchButtonSpinner(false);
                    toggleGeocodingFailureMessage(true);
                }, handleLogRequestAndFilterBoundaryMapOptionsError);
            }

            function logRequestAndFilterBoundaryMapOptions(leagueLookupPerformed, results) {
                var data = {
                    sportCode: sportCode,
                    searchAddress: searchAddress,
                    searchAddressSuccessfullyGeocoded: searchAddressSuccessfullyGeocoded,
                    formattedAddress: searchAddressSuccessfullyGeocoded ? formattedAddress : null,
                    geocodeAccuracyLevel: searchAddressSuccessfullyGeocoded ? geocodeAccuracyLevel : null,
                    latitude: searchAddressSuccessfullyGeocoded ? latLng.lat : null,
                    longitude: searchAddressSuccessfullyGeocoded ? latLng.lng : null,
                    leagueLookupPerformed: leagueLookupPerformed
                };

                if (results && results.length > 0) {
                    data.boundaryMapOptions = $.map(results, function (r) { return { leagueId: r.leagueid, objectId: r.objectid }; });
                }

                return $.post(leagueFinderApiBaseUrl + 'LeagueData/LogRequestAndFilterBoundaryMapOptions', data);
            }

            function handleGetLeagueIdsError(err) {
                toggleSearchButtonSpinner(false);
                toggleLeagueLookupFailureMessage(true);
            }

            function updateMap(mapOptionsResult, formattedAddress, isRooftopMatch) {
                $('[data-role="selected-sport-type-display"]').text($('#sport-type-input option[value="' + sportCode + '"]').text());
                $('[data-role="formatted-search-address-display"]').text(formattedAddress);

                var searchId = mapOptionsResult.searchId;
                $('[data-role="search-id-input"]').val(searchId);

                var matchingMapCount = mapOptionsResult.matchingBoundaryMaps.length;
                if (matchingMapCount > 0) {
                    if (matchingMapCount === 1 || (matchingMapCount > 1 && mapOptionsResult.multipleBoundaryMapsAllowed)) {
                        var result = mapOptionsResult.matchingBoundaryMaps[0];
                        mapManager.updateMap(result.objectId, latLng, formattedAddress, isRooftopMatch);

                        var leagueNames = $.map(mapOptionsResult.matchingBoundaryMaps, function (x) { return x.leagueName; }).sort();
                        $('[data-role="league-result-league-name-display"]').text(leagueNames.join('/'));
                        $('[data-role="league-result-asterisk-display"]').text(isRooftopMatch ? '' : '*');
                        $('[data-role="league-result-league-location-display-wrapper"]').toggle($.trim(result.leagueLocation) !== ',');
                        $('[data-role="league-result-league-location-display"]').text(result.leagueLocation);
                        $('#league-result-website').attr('href', result.website).attr('data-search-id', searchId);
                        $('#league-result-website').toggle(result.website && matchingMapCount === 1 ? true : false);

                        toggleMapDisplay(true);
                        toggleApproximateMatch(!isRooftopMatch);
                    }
                    else {
                        $('[data-role="league-result-league-name-display"]').text('Little League International');
                        toggleMultipleResults(true);
                    }
                } else {
                    $('[data-role="league-result-league-name-display"]').text('Little League International');
                    toggleNoResults(true);
                }

                toggleSearchButtonSpinner(false);
            }

            function handleLogRequestAndFilterBoundaryMapOptionsError(err) {
                toggleSearchButtonSpinner(false);
                toggleLeagueLookupFailureMessage(true);
            }
        });
    }

    function toggleSearchButtonSpinner(showPleaseWait) {
        $('#search-button-text').text(showPleaseWait ? 'Finding Your League. Please Wait...' : 'Find Your League');
        $('#search-button-icon').toggleClass('fa-search', !showPleaseWait).toggleClass(new Array('fa-spinner', 'fa-spin'), showPleaseWait);
        $('#search-button').prop('disabled', showPleaseWait);
    }

    var geocodeCache = {};
    function geocodeAddress(address, callback) {
        //callback({
        //    success: true,
        //    formattedAddress: '(Address without a league test)',
        //    latLng: {
        //        lat: 0,
        //        lng: 0
        //    }
        //});
        if (geocodeCache[address]) {
            callback(geocodeCache[address]);
        }
        else {
            geocoder.geocode({ 'address': address }, function (results, status) {
                if (status === 'OK') {
                    var l = results[0].geometry.location;
                    var latLng = {
                        lat: l.lat(),
                        lng: l.lng()
                    };
                    var formattedAddress = results[0].formatted_address;
                    var accuracyLevel = results[0].geometry.location_type;

                    var countryComponent = $.grep(results[0].address_components, function (x) { return ($.inArray('country', x.types) > -1); });
                    var addressCountry = countryComponent ? countryComponent[0].short_name : null;

                    geocodeCache[address] = {
                        success: true,
                        latLng: latLng,
                        formattedAddress: formattedAddress,
                        accuracyLevel: accuracyLevel,
                        addressCountry: addressCountry
                    };
                } else {
                    geocodeCache[address] = {
                        success: false
                    };
                }
                callback(geocodeCache[address]);
            });
        }
    }
});

// Contact Form
$(function () {
    $('#contact-form').validate({
        rules: {
            'your-name': {
                required: true
            },
            'your-email': {
                required: true,
                email: true
            },
            'contact-reason': {
                required: true
            },
            'communications-consent': {
                required: true
            },
            'communications-preferences': {
                required: true,
                minlength: 0
            }
        },
        messages: {
            'your-name': 'Please enter parent/legal guardian name.',
            'your-email': {
                required: 'Please enter parent/legal guardian email address.',
                email: 'Please enter a valid email address.'
            },
            'contact-reason': 'Please select a contact reason.',
            'communications-consent': 'Please indicate communications consent.',
            'communications-preferences': 'Please indicate your communication preferences.'
        },
        errorPlacement: function (error, element) {
            if (element.is(":radio") || element.is(":checkbox"))
                error.appendTo(element.parents('.form-group'));
            else
                error.appendTo(element.parent());
        },
        submitHandler: submitContactForm
    });

    $('[name="communications-consent"]').change(function () {
        var show = $('[name="communications-consent"]:checked').val() === 'true';
        toggleContactFormCommunicationPreferencesRow(show);
    });

    function submitContactForm() {
        var $form = $('#contact-form');
        var searchId = $form.find('[name="search-id"]').val();
        var name = $form.find('[name="your-name"]').val();
        var emailAddress = $form.find('[name="your-email"]').val();
        var contactReason = $form.find('[name="contact-reason"]').val();
        var commentOrQuestion = $form.find('[name="comment-question"]').val();
        var communicationsConsent = $form.find('[name="communications-consent"]:checked').val();

        var communicationsPreferences = [];
        $.each($form.find('[name="communications-preferences"]:checked'), function (x) { communicationsPreferences.push($(this).val()) });

        toggleSendMessageButtonSpinner(true);
        sendMessage(searchId, name, emailAddress, contactReason, commentOrQuestion, communicationsConsent, communicationsPreferences).then(function () {
            toggleSendMessageButtonSpinner(false);
            toggleContactForm(false);
            toggleContactFormSuccessMessage(true);
            window.parent.scrollTo(0, 0);
        }, function () {
            toggleSendMessageButtonSpinner(false);
            toggleContactForm(false);
            toggleContactFormFailureMessage(true);
            window.parent.scrollTo(0, 0);
        });
    }

    function toggleSendMessageButtonSpinner(showPleaseWait) {
        var $btn = $('#contact-form-submit-button');
        $btn.find('#contact-form-submit-button-text').text(showPleaseWait ? 'Sending Message. Please Wait...' : 'Send Message');
        $btn.find('#contact-form-submit-button-icon').toggleClass('fa-envelope', !showPleaseWait).toggleClass(new Array('fa-spinner', 'fa-spin'), showPleaseWait);
        $btn.prop('disabled', showPleaseWait);
    }
});

function sendMessage(searchId, fromName, fromEmailAddress, reasonForContact, commentOrQuestion, communicationsConsent, communicationsPreferences) {
    // FB/GA Tracking
    try {
        fbq('trackCustom', 'Contact My League');
        goog_snippet_vars = function () {
            var w = window;
            w.google_conversion_id = 942821740;
            w.google_conversion_label = "4w4rCO3P13AQ7KLJwQM";
            w.google_remarketing_only = false;
        };
        goog_report_conversion();
    } catch (err) {
        //
    }

    var data = {
        searchId: searchId,
        fromName: fromName,
        fromEmailAddress: fromEmailAddress,
        reasonForContact: reasonForContact,
        commentOrQuestion: commentOrQuestion,
        newsletterConsent: communicationsConsent,
        promotionsConsent: communicationsConsent,
        communicationsPreferences: communicationsPreferences
    };
    return $.post(leagueFinderApiBaseUrl + 'LeagueData/SendMessage', data);
}

// Outbound Link Click
$(function () {
    $('#league-result-website').click(function () {
        try {
            var searchId = $(this).data('search-id');
            var outboundLinkUrl = $(this).attr('href');

            var data = {
                searchId: searchId,
                outboundLinkUrl: outboundLinkUrl
            };
            return $.post(leagueFinderApiBaseUrl + 'LeagueData/LogOutboundLinkClick', data);
        } catch (err) {
            //
        }
    });
});