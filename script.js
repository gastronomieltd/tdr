// This function contains all your site's code
const initializeApp = () => {

    // ==========================================================================
    // Your Unified Google Sheet Web App URL
    // ==========================================================================
    const GOOGLE_SHEET_ENQUIRY_URL = 'https://script.google.com/macros/s/AKfycbz9N2Y6oZZzBigEKrVjFsZLphHCRSkL2LNh0iG0xrUQMeH7u_eEL_E9si_q4GMCEh4y/exec';
    const GOOGLE_SHEET_MENU_URL = 'https://script.google.com/macros/s/AKfycbzjiCsO-ZF72QTLWEP-k18L2glWtF3sWE3giy9cyvIURwOqbpI7D1owwiYLLwLYfqzmLQ/exec';
    // Global variable to store sheet items
    let MENU_DATA = [];
    
    // Automatically detect which tab is marked 'active' in your HTML on page load
    const initialActiveTab = document.querySelector('.menu-tab.active');
    let activeCategoryTab = initialActiveTab ? initialActiveTab.getAttribute('data-tab') : 'lunch';

    const menuGrid = document.getElementById('dynamicMenuGrid');
    const searchInput = document.getElementById('menuSearch');
    const tabButtons = document.querySelectorAll('.menu-tab');

    const renderMenu = (category, searchKeyword = '') => {
        if (!menuGrid) return;
        menuGrid.innerHTML = ''; 

        const query = searchKeyword.toLowerCase().trim();

        // 1. Filter items matching the active category tab and search query
        const filteredItems = MENU_DATA.filter(item => {
            const matchesCategory = item.category === category;
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
            
            // Generate a full-width subheader spanning both columns
            const subheaderHTML = `
                <div class="menu-subcategory-header" style="grid-column: 1 / -1; margin-top: ${isFirstSection ? '0' : '10px'}; margin-bottom: 10px;">
                    <h3 style="font-family: var(--font-heading); color: var(--accent-color); font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                        ${subcategoryName}
                    </h3>
                </div>
            `;
            menuGrid.insertAdjacentHTML('beforeend', subheaderHTML);
            isFirstSection = false;

            // Render each item belonging to this subcategory
            groupedItems[subcategoryName].forEach(item => {
                // Process Tags
                const tagsArray = item.tags ? item.tags.toString().split(',').map(t => t.trim()).filter(t => t !== '') : [];
                const tagsHTML = tagsArray.map(tag => `<span style="background-color: var(--accent-color); color: #fff; font-size: 10px; padding: 2px 6px; margin-left: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${tag}</span>`).join('');
                
                // Process Extras
                let extrasHTML = '';
                if (item.extras) {
                    const extrasArray = item.extras.toString().split(',').map(x => x.trim()).filter(x => x !== '');
                    if (extrasArray.length > 0) {
                        extrasHTML = `
                            <div class="menu-item-extras" style="margin-top: 10px; font-size: 12px; color: var(--accent-color); font-weight: 500; font-family: var(--font-body);">
                                <span style="font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: var(--text-dark); margin-right: 6px;">Add-ons:</span>
                                ${extrasArray.join(' &bull; ')}
                            </div>
                        `;
                    }
                }

                // Generate individual card HTML
                const itemHTML = `
                    <div class="menu-item">
                        <div class="menu-item-header">
                            <h3 class="menu-item-name">${item.name} ${tagsHTML}</h3>
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

    const loadMenuFromSheet = () => {
        if (menuGrid) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 10px; color: var(--accent-color);"></i>Loading our daily offerings...</div>`;
        }

        // DYNAMIC PARAMETER: Detects if the current page is daytime or nighttime
        const isNightPage = document.body.classList.contains('night-mode');
        const sheetParam = isNightPage ? '?sheet=MenuEvening' : '?sheet=MenuDay';

        // Appends the parameter directly to your Web App URL
        fetch(GOOGLE_SHEET_MENU_URL + sheetParam)
            .then(response => response.json())
            .then(data => {
                MENU_DATA = data;
                renderMenu(activeCategoryTab);
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
    const navLinksList = document.querySelectorAll('.nav-link');

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

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
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
            greeting = 'Good afternoon &amp; Welcome to Our Sanctuary';
        } else if (hour >= 17 || hour < 5) {
            greeting = 'Good evening &amp; Welcome to Our Sanctuary';
        }

        subtitle.innerHTML = greeting;
    };

    updateHeroGreeting();

    const subjectSelect = document.getElementById('subject');
    const bookingFields = document.getElementById('bookingFields');

    if (subjectSelect && bookingFields) {
        subjectSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Afternoon Tea Booking') {
                bookingFields.classList.remove('hidden');
                // Make the sub-fields required
                document.getElementById('bookDate').required = true;
                document.getElementById('bookTime').required = true;
                document.getElementById('guests').required = true;
            } else {
                bookingFields.classList.add('hidden');
                // Remove required status
                document.getElementById('bookDate').required = false;
                document.getElementById('bookTime').required = false;
                document.getElementById('guests').required = false;
            }
        });
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
            badge.innerHTML = '<span style="color: #e76f51; border: 1px solid #e76f51; padding: 6px 12px; border-radius: 20px; display: inline-block; white-space: nowrap;">● WE ARE CURRENTLY CLOSED</span>';
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
};

// SAFE LAUNCH: If the browser is already loaded, run immediately. If not, wait for DOM.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}