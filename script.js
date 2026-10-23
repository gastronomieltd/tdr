// This function contains all your site's code
const initializeApp = () => {

    // ==========================================================================
    // Your Unified Google Sheet Web App URL
    // ==========================================================================
    const GOOGLE_SHEET_ENQUIRY_URL = 'https://script.google.com/macros/s/AKfycbz9N2Y6oZZzBigEKrVjFsZLphHCRSkL2LNh0iG0xrUQMeH7u_eEL_E9si_q4GMCEh4y/exec';
    const GOOGLE_SHEET_SITECONFIG_URL = 'https://script.google.com/macros/s/AKfycbzjiCsO-ZF72QTLWEP-k18L2glWtF3sWE3giy9cyvIURwOqbpI7D1owwiYLLwLYfqzmLQ/exec';
        
    // Global variable to store sheet items
    let MENU_DATA = [];
    
    // Automatically detect which tab is marked 'active' in your HTML on page load
    const initialActiveTab = document.querySelector('.menu-tab.active');
    let activeCategoryTab = initialActiveTab ? initialActiveTab.getAttribute('data-tab') : 'lunch';

    const menuGrid = document.getElementById('dynamicMenuGrid');
    const searchInput = document.getElementById('menuSearch');
    const tabButtons = document.querySelectorAll('.menu-tab');
    const categoryNoteEl = document.getElementById('categoryNoteDisplay');

    // The "day-special" tab is virtual: it pulls in any item flagged with the
    // Special column, regardless of that item's actual category, so the same
    // item can appear both under its normal category and under Specials.
    const isSpecialItem = (item) => (item.special || '').toString().trim().toLowerCase() === 'yes';

    const renderMenu = (category, searchKeyword = '') => {
        if (!menuGrid) return;
        menuGrid.innerHTML = '';

        const query = searchKeyword.toLowerCase().trim();
        const isSpecialTab = category === 'day-special';

        // Category note stays visible regardless of the search term, so look it up
        // across all items in this category (not just the ones matching the search)
        if (categoryNoteEl) {
            const categoryNoteItem = MENU_DATA.find(item => (isSpecialTab ? isSpecialItem(item) : item.category === category) && item.categorynote);
            categoryNoteEl.textContent = categoryNoteItem ? categoryNoteItem.categorynote : '';
        }

        // 1. Filter items matching the active category tab and search query
        const filteredItems = MENU_DATA.filter(item => {
            const matchesCategory = isSpecialTab ? isSpecialItem(item) : item.category === category;
            const matchesSearch =
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.subcategory.toLowerCase().includes(query) ||
                (item.tags && item.tags.toLowerCase().includes(query)) ||
                (item.extras && item.extras.toLowerCase().includes(query));
            return matchesCategory && matchesSearch;
        });

        if (filteredItems.length === 0) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No matching items found.</div>`;
            return;
        }

        // 2. Group the filtered items by their subcategory field
        const groupedItems = {};
        filteredItems.forEach(item => {
            // Fallback header name if the Subcategory cell is left empty in Google Sheets
            const subName = item.subcategory ? item.subcategory.trim() : 'House Selection';
            if (!groupedItems[subName]) {
                groupedItems[subName] = [];
            }
            groupedItems[subName].push(item);
        });

        // 3. Loop through each subcategory group and render
        let isFirstSection = true;
        for (const subcategoryName in groupedItems) {

            // A subcategory note only needs to be set on one item in the group
            const subcategoryNoteItem = groupedItems[subcategoryName].find(item => item.subcategorynote);
            const subcategoryNoteHTML = subcategoryNoteItem
                ? `<p style="margin-top: 4px; font-size: 12px; color: var(--accent-text); font-weight: 500; font-family: var(--font-body);">${subcategoryNoteItem.subcategorynote}</p>`
                : '';

            // Generate a full-width subheader spanning both columns
            const subheaderHTML = `
                <div class="menu-subcategory-header">
                    <h3>${subcategoryName}</h3>
                    ${subcategoryNoteHTML}
                </div>
            `;
            menuGrid.insertAdjacentHTML('beforeend', subheaderHTML);
            isFirstSection = false;

            // Render each item belonging to this subcategory
            groupedItems[subcategoryName].forEach(item => {
                // Process Tags
                const tagsArray = item.tags ? item.tags.toString().split(',').map(t => t.trim()).filter(t => t !== '') : [];
                const tagsHTML = tagsArray.map(tag => `<span style="background-color: var(--accent-color); color: var(--primary-color); font-size: 10px; padding: 2px 6px; margin-left: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${tag}</span>`).join('');
                
                // Process Extras
                let extrasHTML = '';
                if (item.extras) {
                    const extrasArray = item.extras.toString().split(',').map(x => x.trim()).filter(x => x !== '');
                    if (extrasArray.length > 0) {
                        extrasHTML = `
                            <div class="menu-item-extras" style="margin-top: 10px; font-size: 12px; color: var(--accent-text); font-weight: 500; font-family: var(--font-body);">
                                <span style="font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: var(--text-dark); margin-right: 6px;">Add-ons:</span>
                                ${extrasArray.join(' &bull; ')}
                            </div>
                        `;
                    }
                }

                // Afternoon Tea items always span the full row, whether shown under
                // their own category tab or pulled into the Specials tab
                const isFullRow = item.category === 'afternoon-tea';

                // Generate individual card HTML
                const itemHTML = `
                    <div class="menu-item${isFullRow ? ' menu-item-full' : ''}">
                        <div class="menu-item-header">
                            <span class="menu-item-name-group">
                                <h3 class="menu-item-name">${item.name}</h3>${tagsHTML ? `<span class="menu-item-badges">${tagsHTML}</span>` : ''}
                            </span>
                            <span class="menu-item-price">${item.price}</span>
                        </div>
                        <p class="menu-item-desc">${item.description}</p>
                        ${extrasHTML}
                    </div>
                `;
                menuGrid.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    };

    // Builds Schema.org Menu structured data from the live sheet data, so it
    // always reflects the actual current menu instead of going stale like a
    // hand-written version would. Lets dish names/prices show in rich results.
    const buildMenuSchema = () => {
        if (!MENU_DATA || MENU_DATA.length === 0) return;

        // Reuse the same labels shown on the tab buttons, so the schema always
        // matches what's visibly on the page rather than a separately maintained list
        const categoryLabels = {};
        tabButtons.forEach(btn => {
            categoryLabels[btn.getAttribute('data-tab')] = btn.textContent.trim();
        });

        const sections = {};
        MENU_DATA.forEach(item => {
            if (!item.category || !item.name) return;
            if (!sections[item.category]) sections[item.category] = [];

            const price = parseFloat(item.price);
            const menuItem = {
                "@type": "MenuItem",
                "name": item.name
            };
            if (item.description) menuItem.description = item.description;
            if (!isNaN(price)) {
                menuItem.offers = {
                    "@type": "Offer",
                    "price": price.toFixed(2),
                    "priceCurrency": "GBP"
                };
            }
            sections[item.category].push(menuItem);
        });

        const schema = {
            "@context": "https://schema.org",
            "@type": "Menu",
            "hasMenuSection": Object.keys(sections).map(catKey => ({
                "@type": "MenuSection",
                "name": categoryLabels[catKey] || catKey,
                "hasMenuItem": sections[catKey]
            }))
        };

        // Remove any previously injected menu schema so re-loads don't stack duplicates
        const existing = document.getElementById('menuSchema');
        if (existing) existing.remove();

        const schemaTag = document.createElement('script');
        schemaTag.type = 'application/ld+json';
        schemaTag.id = 'menuSchema';
        schemaTag.textContent = JSON.stringify(schema);
        document.head.appendChild(schemaTag);
    };

    const loadMenuFromSheet = () => {
        if (menuGrid) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 10px; color: var(--accent-color);"></i>Loading our daily offerings...</div>`;
        }

        // DYNAMIC PARAMETER: Detects if the current page is daytime or nighttime
        const isNightPage = document.body.classList.contains('night-mode');
        const sheetName = isNightPage ? 'MenuEvening' : 'MenuDay';

        MenuCache.getMenuData(sheetName)
            .then(data => {
                MENU_DATA = data;
                renderMenu(activeCategoryTab);
                buildMenuSchema();
            })
            .catch(error => {
                console.error('Error loading menu:', error);
                if (menuGrid) {
                    menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Unable to load the menu at this time. Please try refreshing.</div>`;
                }
            });
    };

    loadMenuFromSheet();

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            activeCategoryTab = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            renderMenu(activeCategoryTab, searchInput ? searchInput.value : '');
        });
    });

    if (searchInput) {
        searchInput.addEventListener('focus', () => searchInput.style.borderColor = 'var(--accent-color)');
        searchInput.addEventListener('blur', () => searchInput.style.borderColor = 'var(--border-color)');
        
        searchInput.addEventListener('input', (e) => {
            renderMenu(activeCategoryTab, e.target.value);
        });
    }

    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinksList = document.querySelectorAll('.nav-link, .nav-link-sub');

    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        if (navMenu.classList.contains('active')) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
    };

    const closeMenu = () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
    };

    hamburger.addEventListener('click', toggleMenu);

    navLinksList.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Desktop-only "more" dropdown: Specialities, Private Events, Gift
    // Vouchers, Gallery - tucked behind this instead of being always-on
    // links next to Menu/Visit/Contact Us
    const navMoreToggle = document.querySelector('.nav-more-toggle');
    const navMoreDropdown = document.querySelector('.nav-more-dropdown');

    if (navMoreToggle && navMoreDropdown) {
        const closeNavMore = () => {
            navMoreToggle.classList.remove('active');
            navMoreDropdown.classList.remove('active');
            navMoreToggle.setAttribute('aria-expanded', 'false');
        };

        navMoreToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navMoreDropdown.classList.toggle('active');
            navMoreToggle.classList.toggle('active', isOpen);
            navMoreToggle.setAttribute('aria-expanded', String(isOpen));
        });

        navMoreDropdown.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeNavMore);
        });

        document.addEventListener('click', (e) => {
            if (!navMoreDropdown.contains(e.target) && e.target !== navMoreToggle) {
                closeNavMore();
            }
        });
    }

    const sections = document.querySelectorAll('section');

    const scrollSpy = () => {
        const scrollPosition = window.scrollY + 120;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinksList.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };

    window.addEventListener('scroll', scrollSpy);

    // ==========================================================================
    // 5. Scroll Reveal Intersection Observer
    // ==========================================================================
    const revealElements = document.querySelectorAll('.reveal, .reveal-zoom');

    // Configuration settings for when to trigger the animation
    const revealOptions = {
        threshold: 0.1,        // Triggers when at least 10% of the element is visible
        rootMargin: '0px 0px -60px 0px' // Offset triggers slightly before entering view
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Apply the active transition class
                entry.target.classList.add('active');
                
                // Stop watching this element once it is revealed to preserve memory
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    // Bind each designated element to the observer
    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    const contactForm = document.getElementById('contactForm');
    const formSuccessMsg = document.getElementById('formSuccess');
    
    let isFormSubmitting = false;

    if (contactForm && formSuccessMsg) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();

            if (isFormSubmitting) {
                return; 
            }

            isFormSubmitting = true;

            const submitBtn = contactForm.querySelector('.btn-submit');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // If ordering a cake, lead the message with the chosen cake & price
            // so it's immediately visible, with whatever the customer typed after it
            let messageValue = document.getElementById('message').value;
            const cakeChoiceEl = document.getElementById('cakeChoice');
            if (cakeChoiceEl && cakeChoiceEl.value) {
                messageValue = 'Cake: ' + cakeChoiceEl.value + '\n\n' + messageValue;
            }

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                subject: document.getElementById('subject').value,
                message: messageValue,
                bookDate: document.getElementById('bookDate').value,
                bookTime: document.getElementById('bookTime').value,
                guests: document.getElementById('guests').value
            };

            fetch(GOOGLE_SHEET_ENQUIRY_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(() => {
                contactForm.classList.add('hidden');
                formSuccessMsg.classList.remove('hidden');
                contactForm.reset();
                isFormSubmitting = false;
            })
            .catch(error => {
                console.error('Submission error:', error);
                alert('We encountered a problem sending your message. Please try again.');
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
                isFormSubmitting = false;
            });
        });
    }

    const updateHeroGreeting = () => {
        const subtitle = document.querySelector('.hero-subtitle');
        if (!subtitle) return;

        const hour = new Date().getHours();
        let greeting = 'Welcome to Our Sanctuary';

        if (hour >= 5 && hour < 12) {
            greeting = 'Good morning &amp; Welcome to Our Sanctuary';
        } else if (hour >= 12 && hour < 17) {
            greeting = 'Good Afternoon &amp; Welcome to Our Sanctuary';
        } else if (hour >= 17 || hour < 5) {
            greeting = 'Good evening &amp; Welcome to Our Sanctuary';
        }

        subtitle.innerHTML = greeting;
    };

    updateHeroGreeting();

    // Today's Bakes: derive each cake's display name from its image filename
    // (e.g. "carrot-cake-2.jpg" -> "Carrot Cake"), so captions stay in sync
    // with whichever photos are actually in the strip without hardcoding names.
    const deriveCakeName = (src) => {
        const filename = src.split('/').pop().replace(/\.[a-z]+$/i, '');
        const withoutIndex = filename.replace(/-\d+$/, '');
        return withoutIndex
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // ==========================================================================
    // Today's Bakes: list every photo in images/bakes/ dynamically, via the
    // GitHub API, so adding/removing a cake photo there is all that's needed -
    // no HTML edits. Falls back to a fixed list if the API is unreachable or
    // rate-limited (it's unauthenticated, capped around 60 requests/hour per
    // visitor IP).
    // ==========================================================================
    const BAKES_FOLDER = 'images/bakes';
    const BAKES_FALLBACK = [
        'victoria-sponge-cake.jpg',
        'chocolate-fudge-cake.jpg',
        'caramel-cake.jpg',
        'carrot-walnut-cake.jpg',
        'coffee-walnut-cake.jpg'
    ];
    const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;

    const listBakesImages = () => {
        return fetch('https://api.github.com/repos/gastronomieltd/tdr/contents/' + BAKES_FOLDER)
            .then(response => {
                if (!response.ok) throw new Error('GitHub API request failed: ' + response.status);
                return response.json();
            })
            .then(files => {
                const names = files
                    .filter(f => f.type === 'file' && IMAGE_EXT_RE.test(f.name))
                    .map(f => f.name)
                    .sort();
                return names.length ? names : BAKES_FALLBACK;
            })
            .catch(error => {
                console.error('Could not list images/bakes/ from GitHub, using fallback list:', error);
                return BAKES_FALLBACK;
            });
    };

    const renderBakesStrip = (filenames) => {
        const mobilePhoto = document.getElementById('bakesStripPhoto');
        const mobileCaption = document.getElementById('bakesStripCaption');
        const desktopRow = document.getElementById('bakesStripRow');
        if (!mobilePhoto || !mobileCaption || !desktopRow) return;

        const items = filenames.map(name => ({
            src: BAKES_FOLDER + '/' + name,
            name: deriveCakeName(name)
        }));

        // Mobile: one <img> per photo, all stacked and crossfaded via the
        // "is-active" class (see .bakes-strip-photo img in style.css)
        mobilePhoto.innerHTML = '';
        items.forEach(item => {
            const img = document.createElement('img');
            img.src = item.src;
            img.loading = 'lazy';
            img.alt = item.name;
            mobilePhoto.appendChild(img);
        });
        const mobileImages = mobilePhoto.querySelectorAll('img');

        let activeIndex = 0;
        const showSlide = (index) => {
            mobileImages.forEach(img => img.classList.remove('is-active'));
            mobileImages[index].classList.add('is-active');
            mobileCaption.classList.remove('is-active');
            // Let the caption fade out, then swap its text and fade back in
            window.setTimeout(() => {
                mobileCaption.textContent = items[index].name;
                mobileCaption.classList.add('is-active');
            }, 300);
        };
        showSlide(0);
        if (items.length > 1) {
            window.setInterval(() => {
                activeIndex = (activeIndex + 1) % items.length;
                showSlide(activeIndex);
            }, 4000);
        }

        // Desktop: build the tile row twice over so the CSS scroll loop
        // (translateX(-50%)) is seamless, whatever the photo count is
        const buildTile = (item, hidden) => {
            const tile = document.createElement('div');
            tile.className = 'bakes-tile';
            if (hidden) tile.setAttribute('aria-hidden', 'true');
            tile.innerHTML =
                '<span class="bakes-tile-photo"><img src="' + item.src + '" loading="lazy" alt="' + (hidden ? '' : item.name) + '"></span>' +
                '<span class="bakes-tile-name">' + item.name + '</span>';
            return tile;
        };
        desktopRow.innerHTML = '';
        items.forEach(item => desktopRow.appendChild(buildTile(item, false)));
        items.forEach(item => desktopRow.appendChild(buildTile(item, true)));

        // Keep the per-tile scroll speed constant regardless of how many
        // photos there are (~7.2s/tile, matching the original 5-photo pace)
        desktopRow.style.setProperty('--bakes-scroll-duration', (items.length * 7.2) + 's');
    };

    listBakesImages().then(renderBakesStrip);

    const subjectSelect = document.getElementById('subject');
    const bookingFields = document.getElementById('bookingFields');
    const cakeOrderFields = document.getElementById('cakeOrderFields');

    const guestsGroup = document.getElementById('guestsGroup');

    if (subjectSelect && bookingFields) {
        const handleBookingFieldsVisibility = (value) => {
            const isCakeOrder = value === 'Order a Cake';

            if (value === 'Book Afternoon Tea' || value === 'Event Inquiry' || isCakeOrder) {
                bookingFields.classList.remove('hidden');
                document.getElementById('bookDate').required = true;
                document.getElementById('bookTime').required = true;
            } else {
                bookingFields.classList.add('hidden');
                document.getElementById('bookDate').required = false;
                document.getElementById('bookTime').required = false;
            }

            // Cake orders need to be placed by 2pm for next-day collection -
            // after 2pm, next day no longer gives a full day's notice, so the
            // earliest selectable date pushes out to the day after that
            // (anyone needing one sooner is pointed to the enquiry form instead)
            const bookDateEl = document.getElementById('bookDate');
            if (isCakeOrder) {
                const now = new Date();
                const daysAhead = now.getHours() < 14 ? 1 : 2;
                const earliest = new Date();
                earliest.setDate(earliest.getDate() + daysAhead);
                const minDate = earliest.getFullYear() + '-' +
                    String(earliest.getMonth() + 1).padStart(2, '0') + '-' +
                    String(earliest.getDate()).padStart(2, '0');
                bookDateEl.min = minDate;
                if (bookDateEl.value && bookDateEl.value < minDate) {
                    bookDateEl.value = '';
                }
            } else {
                bookDateEl.removeAttribute('min');
            }

            // Cake orders need a collection date/time, but not a guest count
            if (guestsGroup) {
                guestsGroup.classList.toggle('hidden', isCakeOrder);
            }
            document.getElementById('guests').required = (value === 'Book Afternoon Tea' || value === 'Event Inquiry');

            if (cakeOrderFields) {
                if (isCakeOrder) {
                    cakeOrderFields.classList.remove('hidden');
                    document.getElementById('cakeChoice').required = true;
                } else {
                    cakeOrderFields.classList.add('hidden');
                    document.getElementById('cakeChoice').required = false;
                }
            }

        };

        // Listen for user select changes
        subjectSelect.addEventListener('change', (e) => {
            handleBookingFieldsVisibility(e.target.value);
        });

        // Run once on page load to set the correct initial state
        // (This makes the booking fields visible by default on evening.html!)
        handleBookingFieldsVisibility(subjectSelect.value);

        // "Book Afternoon Tea" hero button: pre-select the subject and reveal
        // the date/time fields before the page scrolls down to the form
        const bookAfternoonTeaBtn = document.getElementById('bookAfternoonTeaBtn');
        if (bookAfternoonTeaBtn) {
            bookAfternoonTeaBtn.addEventListener('click', () => {
                subjectSelect.value = 'Book Afternoon Tea';
                handleBookingFieldsVisibility('Book Afternoon Tea');
            });
        }

        // "We bake cakes to order" link in Today's Bakes: pre-select the
        // subject and reveal the cake picker before the page scrolls down
        const orderCakeLink = document.getElementById('orderCakeLink');
        if (orderCakeLink) {
            orderCakeLink.addEventListener('click', () => {
                subjectSelect.value = 'Order a Cake';
                handleBookingFieldsVisibility('Order a Cake');
            });
        }

        // "Enquire About an Event" button: pre-select the subject before
        // the page scrolls down to the form
        const eventEnquiryLink = document.getElementById('eventEnquiryLink');
        if (eventEnquiryLink) {
            eventEnquiryLink.addEventListener('click', () => {
                subjectSelect.value = 'Event Inquiry';
                handleBookingFieldsVisibility('Event Inquiry');
            });
        }

        // "Enquire About a Voucher" button: pre-select the subject and
        // reveal the voucher value field before the page scrolls to the form
        const voucherEnquiryLink = document.getElementById('voucherEnquiryLink');
        if (voucherEnquiryLink) {
            voucherEnquiryLink.addEventListener('click', () => {
                subjectSelect.value = 'Gift Voucher';
                handleBookingFieldsVisibility('Gift Voucher');
            });
        }
    }

    // Afternoon Tea booking slots: 30-minute increments, 10:00am-3:00pm Mon-Fri,
    // 10:00am-2:00pm Saturday, closed Sunday - the valid slot list depends on
    // which date is picked, so it's rebuilt every time the date changes.
    // Afternoon Tea needs 5 hours' notice, so same-day bookings also drop
    // any slot less than 5 hours from now.
    const bookDateInput = document.getElementById('bookDate');
    const bookTimeSelect = document.getElementById('bookTime');

    if (bookDateInput && bookTimeSelect) {
        const formatDateStr = (d) => d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

        // Can't book in the past, so today is the earliest selectable date -
        // unless the 5-hour notice already rules out every slot today (or
        // today's Sunday, when we're closed), in which case today isn't
        // offered as an option at all and the earliest date becomes tomorrow
        const now = new Date();
        const todayStr = formatDateStr(now);
        const todayDow = now.getDay();
        const todayEndHour = todayDow === 6 ? 14 : 15; // Saturday 2pm, Mon-Fri 3pm (closed Sunday)
        const earliestMinutesFromNow = (now.getHours() * 60 + now.getMinutes()) + (5 * 60);
        const todayHasSlotsLeft = todayDow !== 0 && earliestMinutesFromNow <= todayEndHour * 60;

        bookDateInput.min = todayHasSlotsLeft
            ? todayStr
            : formatDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

        // Clear out a stale pre-filled value that's now earlier than min
        if (bookDateInput.value && bookDateInput.value < bookDateInput.min) {
            bookDateInput.value = '';
        }

        const formatTime12h = (hour, minute) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        };

        const populateTimeSlots = () => {
            if (!bookDateInput.value) {
                bookTimeSelect.innerHTML = '<option value="">Select a date first</option>';
                return;
            }

            // Parse as a local date (avoids the UTC off-by-one from new Date('YYYY-MM-DD'))
            const [year, month, day] = bookDateInput.value.split('-').map(Number);
            const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Sunday, 6 = Saturday

            if (dayOfWeek === 0) {
                bookTimeSelect.innerHTML = '<option value="">Closed on Sundays</option>';
                return;
            }

            const startHour = 10;
            const endHour = dayOfWeek === 6 ? 14 : 15; // Saturday: 2pm, Mon-Fri: 3pm (last bookable slot)

            // 5 hours' notice required - for a same-day booking, the earliest
            // valid slot is now + 5 hours; other dates are unaffected
            const now = new Date();
            const isToday = bookDateInput.value === todayStr;
            const earliestMinutesToday = isToday
                ? (now.getHours() * 60 + now.getMinutes()) + (5 * 60)
                : null;

            bookTimeSelect.innerHTML = '<option value="">Select a time</option>';
            let hasSlots = false;
            for (let hour = startHour; hour <= endHour; hour++) {
                for (const minute of [0, 30]) {
                    if (hour === endHour && minute > 0) break;
                    if (isToday && (hour * 60 + minute) < earliestMinutesToday) continue;
                    const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = formatTime12h(hour, minute);
                    bookTimeSelect.appendChild(option);
                    hasSlots = true;
                }
            }

            if (!hasSlots) {
                bookTimeSelect.innerHTML = '<option value="">No slots left today - choose another date</option>';
            }
        };

        bookDateInput.addEventListener('change', populateTimeSlots);
        populateTimeSlots(); // Run once in case a date is already set on load
    }

    // ==========================================================================
    // 6. Back to Top Button Controller
    // ==========================================================================
    const backToTopBtn = document.getElementById('backToTop');

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            // Displays button only after the user scrolls past 1 full screen height
            if (window.scrollY > window.innerHeight) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

// ==========================================================================
    // Dynamic "Open Now" Check (Supports both Day & Night schedules)
    // ==========================================================================
    const checkOpenStatus = () => {
        const badge = document.getElementById('openStatusBadge');
        if (!badge) return;

        const now = new Date();
        const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const timeInMinutes = (hour * 60) + minutes;

        let isOpen = false;

        const isNightPage = document.body.classList.contains('night-mode');

        if (isNightPage) {
            // NIGHT Sched: Thursday, Friday, Saturday from 6:00 PM (1080 mins) to 11:30 PM (1410 mins)
            if (day === 4 || day === 5 || day === 6) {
                if (timeInMinutes >= 1080 && timeInMinutes < 1410) {
                    isOpen = true;
                }
            }
        } else {
            // DAY Sched: Monday - Friday 8:30 AM (510 mins) to 4:30 PM (990 mins)
            if (day >= 1 && day <= 5) {
                if (timeInMinutes >= 510 && timeInMinutes < 990) {
                    isOpen = true;
                }
            } 
            // DAY Sched: Saturday 8:30 AM (510 mins) to 3:30 PM (930 mins)
            else if (day === 6) {
                if (timeInMinutes >= 510 && timeInMinutes < 930) {
                    isOpen = true;
                }
            }
        }

        if (isOpen) {
            badge.innerHTML = '<span style="color: #2ec4b6; border: 1px solid #2ec4b6; padding: 6px 12px; border-radius: 20px; display: inline-block; white-space: nowrap;">● WE ARE OPEN NOW</span>';
        } else {
            badge.innerHTML = '<span style="color: #eb866c; border: 1px solid #eb866c; padding: 6px 12px; border-radius: 20px; display: inline-block; white-space: nowrap;">● WE ARE CURRENTLY CLOSED</span>';
        }
    };
    checkOpenStatus();

    // ==========================================================================
    // Weather Recommendations (Day vs Night Context)
    // ==========================================================================
    const checkWeatherInLocksbottom = () => {
        const recommenderBox = document.getElementById('weatherRecommender');
        const weatherText = document.getElementById('weatherText');
        if (!recommenderBox || !weatherText) return;

        const lat = '51.3653';
        const lon = '0.0631';
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

        const isNightPage = document.body.classList.contains('night-mode');

        fetch(weatherUrl)
            .then(response => response.json())
            .then(data => {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);

                let suggestion = "";

                if (isNightPage) {
                    // Evening-specific recommendations
                    if (isRaining) {
                        suggestion = "It is a damp, rainy evening out in Locksbottom—unwind in our candlelit lounge with a rich glass of Red Wine or our cozy Liqueur Coffee.";
                    } else if (temp >= 18) {
                        suggestion = `It is a pleasant ${temp}°C evening. Enjoy a refreshing, botanically infused Gin &amp; Tonic or botanical spritz in our lounge tonight.`;
                    } else {
                        suggestion = `It is a cool ${temp}°C evening outside. Cosy up on our velvet sofas with a rich dark chocolate torte and our signature Espresso Martini.`;
                    }
                } else {
                    // Daytime-specific recommendations
                    if (isRaining) {
                        suggestion = "It is a damp, rainy day out in Locksbottom—step inside for a comforting Hot Chocolate or a steaming pot of our House Blend Tea.";
                    } else if (temp >= 20) {
                        suggestion = `It is a beautiful ${temp}°C day! Stop by for a refreshing Artisan Flat White served iced, paired with a cool slice of cake.`;
                    } else if (temp < 10) {
                        suggestion = `It is a brisk ${temp}°C outside today. Warm up inside with our signature Loaded Jacket Potato or a fresh-pressed toastie.`;
                    } else {
                        suggestion = `It is a pleasant ${temp}°C out in Locksbottom today—the perfect weather to relax with a warm scone and a loose leaf tea.`;
                    }
                }

                if (suggestion !== "") {
                    weatherText.innerHTML = `<i class="fa-solid fa-cloud-sun" style="color: var(--accent-color); margin-right: 10px;"></i>${suggestion}`;
                    recommenderBox.classList.remove('hidden');
                }
            })
            .catch(error => {
                console.error("Unable to check Locksbottom weather:", error);
            });
    };
    checkWeatherInLocksbottom();

    // ==========================================================================
    // One-Click Address Copier
    // ==========================================================================
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents the outer link anchor from opening
            e.stopPropagation();

            const addressText = '405 Crofton Road, Locksbottom, Orpington, BR6 8NL';
            
            navigator.clipboard.writeText(addressText).then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #2ec4b6;"></i> Copied!';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        });
    }

    // ==========================================================================
    // Menu Dietary Quick-Filter Event Listeners
    // ==========================================================================
    const filterBtns = document.querySelectorAll('.filter-tag-btn');
    if (filterBtns && searchInput) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filterValue = btn.getAttribute('data-filter');
                searchInput.value = filterValue; // Update search input box
                
                // Trigger your existing Fuse.js fuzzy search automatically!
                renderMenu(activeCategoryTab, filterValue);
            });
        });
    }

    // ==========================================================================
    // Gallery Lightbox Controller
    // ==========================================================================
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const galleryItems = document.querySelectorAll('.gallery-item');

    if (lightbox && lightboxImg && galleryItems) {
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                const img = item.querySelector('.gallery-img');
                if (img) {
                    lightboxImg.src = img.src;
                    lightboxImg.alt = img.alt;
                    lightbox.classList.add('show');
                    document.body.classList.add('menu-open'); // Locks background page scrolling
                }
            });
        });

        const closeLightbox = () => {
            lightbox.classList.remove('show');
            document.body.classList.remove('menu-open');
        };

        lightbox.addEventListener('click', closeLightbox);
    }

    // ==========================================================================
    // Fetch & Apply Site Configurations from Google Sheets
    // ==========================================================================
    const loadConfigFromSheet = () => {
        fetch(GOOGLE_SHEET_SITECONFIG_URL + '?sheet=Config')
            .then(response => response.json())
            .then(data => {
                // Convert array of rows into a key-value lookup object
                const config = {};
                data.forEach(row => {
                    if (row.key) {
                        config[row.key.toString().trim().toLowerCase()] = row.value;
                    }
                });

                // 1. Handle Announcement Banner
                const banner = document.getElementById('announcementBanner');
                const bannerText = document.getElementById('announcementText');
                if (banner && bannerText) {
                    if (config.announcement && config.announcement.trim() !== "") {
                        bannerText.textContent = config.announcement;
                        banner.classList.remove('announcement-inactive');
                    } else {
                        banner.classList.add('announcement-inactive');
                    }
                    // The banner's reserved space in the layout doesn't
                    // change when it's shown/hidden (see #announcementBanner
                    // in style.css), so the hero photo never needs to resize
                }

                // 2. Handle Force Mode Page Switching
                const forceMode = config.forcemode ? config.forcemode.toString().trim().toLowerCase() : 'auto';
                const path = window.location.pathname;
                const isEveningPage = path.includes('evening.html');
                const isDayPage = path.includes('index.html') || path.endsWith('/') || path === '';

                // If the user manually clicked a navigation link, respect their session override
                if (sessionStorage.getItem('manual_override') === 'true') {
                    return;
                }

                // Run forced redirects if configured in Google Sheets
                if (forceMode === 'day' && isEveningPage) {
                    window.location.replace('index.html');
                } else if (forceMode === 'evening' && isDayPage) {
                    window.location.replace('evening.html');
                }
            })
            .catch(error => {
                console.error("Error loading site configurations:", error);
            });
    };

    // ==========================================================================
    // Keep the hero photo's height matched to the text column's real height,
    // so the "Book Afternoon Tea" overlay's bottom edge lines up with the
    // bottom of the welcome text/announcement on the right. Safe to run
    // immediately: the announcement banner's space is always reserved in the
    // layout (see #announcementBanner in style.css), so the text column's
    // height is already final at first paint and never changes later when
    // the banner's real content loads in.
    // ==========================================================================
    const syncHeroHeight = () => {
        const heroText = document.querySelector('.hero-about-text');
        const heroImage = document.querySelector('.hero-carousel');
        if (!heroText || !heroImage) return;

        if (window.innerWidth > 1024) {
            heroImage.style.height = heroText.offsetHeight + 'px';
        } else {
            heroImage.style.height = '';
        }
    };

    syncHeroHeight();
    loadConfigFromSheet();

    window.addEventListener('resize', syncHeroHeight);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncHeroHeight);
    }

    // ==========================================================================
    // Automatic Current Weekday Highlighting (Custom 3-Column Aligner)
    // ==========================================================================
    const highlightCurrentDay = () => {
        const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Formulates the exact ID to query (e.g. hours-mon, hours-sat)
        const todayRowId = 'hours-' + weekdays[dayIndex];

        const currentRow = document.getElementById(todayRowId)
        if (currentRow) {
            currentRow.classList.add('highlight');
        }
    };
    highlightCurrentDay();

    // ==========================================================================
    // 9. Dynamic First-Time Intro Preloader (Cinematic Focus & Glow)
    // ==========================================================================
    const introLoader = document.getElementById('introLoader');
    const introLogo = document.getElementById('introLogo');

    if (introLoader && introLogo) {
        if (sessionStorage.getItem('intro_played') !== 'true') {
            // This overlay sits at z-index 9999 in front of the whole page, so
            // every millisecond it holds is a millisecond the header/hero can't
            // visually paint - Lighthouse measured this as a 10s+ Largest
            // Contentful Paint. Kept brief (not removed) so the brand moment
            // still plays, but capped at well under a second rather than 2.4s+.
            // Stage 1: Zoom in slightly, clear blur, and glow golden after a brief load delay
            setTimeout(() => {
                introLogo.style.opacity = '1';
                introLogo.style.transform = 'scale(1.35)'; // Large majestic scale
                introLogo.style.filter = 'blur(0px) drop-shadow(0 0 25px rgba(201, 155, 59, 0.45))'; // Gold aura drop-shadow
            }, 80);

            // Stage 2: Dissolve the dark overlay and unlock page scrolling
            setTimeout(() => {
                // Zoom slightly closer as it fades out to mimic a cinematic camera move
                introLogo.style.transform = 'scale(1.45)';
                introLogo.style.opacity = '0';
                introLogo.style.filter = 'blur(5px)';

                introLoader.style.opacity = '0';
                introLoader.style.visibility = 'hidden';

                document.body.style.overflow = '';
                document.body.style.height = '';

                // Write session token so it bypasses on subsequent clicks
                sessionStorage.setItem('intro_played', 'true');
            }, 500);

            // Clean up the DOM to free browser memory (500ms dissolve start +
            // 1s CSS opacity/visibility transition from the inline style)
            setTimeout(() => {
                introLoader.remove();
            }, 1500);
        } else {
            // If already played in this session, remove the preloader immediately
            introLoader.remove();
        }
    }
};

// SAFE LAUNCH: If the browser is already loaded, run immediately. If not, wait for DOM.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}