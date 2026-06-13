// This function contains all your site's code
const initializeApp = () => {

    // ==========================================================================
    // Your Unified Google Sheet Web App URL
    // ==========================================================================
    const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbz9N2Y6oZZzBigEKrVjFsZLphHCRSkL2LNh0iG0xrUQMeH7u_eEL_E9si_q4GMCEh4y/exec';

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

        const filteredItems = MENU_DATA.filter(item => {
            const matchesCategory = item.category === category;
            const matchesSearch = 
                item.name.toLowerCase().includes(query) || 
                item.description.toLowerCase().includes(query) ||
                item.subcategory.toLowerCase().includes(query) ||
                (item.tags && item.tags.toLowerCase().includes(query));
            return matchesCategory && matchesSearch;
        });

        if (filteredItems.length === 0) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No matching items found.</div>`;
            return;
        }

        filteredItems.forEach(item => {
            const tagsArray = item.tags ? item.tags.toString().split(',').map(t => t.trim()).filter(t => t !== '') : [];
            const tagsHTML = tagsArray.map(tag => `<span style="background-color: var(--accent-color); color: #fff; font-size: 10px; padding: 2px 6px; margin-left: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${tag}</span>`).join('');
            
            const itemHTML = `
                <div class="menu-item">
                    <div class="menu-item-header">
                        <h3 class="menu-item-name">${item.name} ${tagsHTML}</h3>
                        <span class="menu-item-price">${item.price}</span>
                    </div>
                    <p class="menu-item-desc">${item.description}</p>
                </div>
            `;
            menuGrid.insertAdjacentHTML('beforeend', itemHTML);
        });
    };

    const loadMenuFromSheet = () => {
        if (menuGrid) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 10px; color: var(--accent-color);"></i>Loading our daily offerings...</div>`;
        }

        fetch(GOOGLE_SHEET_URL)
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
                message: document.getElementById('message').value
            };

            fetch(GOOGLE_SHEET_URL, {
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
};

// SAFE LAUNCH: If the browser is already loaded, run immediately. If not, wait for DOM.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}