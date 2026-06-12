document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // 1. Mobile Navigation & Body Scroll Lock
    // ==========================================================================
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinksList = document.querySelectorAll('.nav-link');

    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        // Toggles a utility class on the body tag to lock background scrolling
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

    // Close menu when clicking on any navigation link
    navLinksList.forEach(link => {
        link.addEventListener('click', closeMenu);
    });


    // ==========================================================================
    // 2. Dynamic Menu Tab Switcher
    // ==========================================================================
    const tabButtons = document.querySelectorAll('.menu-tab');
    const menuCategories = document.querySelectorAll('.menu-category');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active classes from all buttons and sections
            tabButtons.forEach(btn => btn.classList.remove('active'));
            menuCategories.forEach(cat => cat.classList.remove('active'));

            // Add active classes to the clicked button and targeted tab
            button.classList.add('active');
            
            const activeCategory = document.getElementById(targetTab);
            if (activeCategory) {
                activeCategory.classList.add('active');
            }
        });
    });


    // ==========================================================================
    // 3. Active Link Highlight on Scroll (Scrollspy)
    // ==========================================================================
    const sections = document.querySelectorAll('section');

    const scrollSpy = () => {
        const scrollPosition = window.scrollY + 120; // High precision offset for sticky nav

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
    // 4. Contact Form Live Google Sheets Integration & Submission Feedback
    // ==========================================================================
    const contactForm = document.getElementById('contactForm');
    const formSuccessMsg = document.getElementById('formSuccess');

    // PASTE YOUR DEPLOYED GOOGLE WEB APP URL HERE:
    const GOOGLE_SHEET_URL = 'PASTE_YOUR_GOOGLE_WEB_APP_URL_HERE';

    if (contactForm && formSuccessMsg) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Stop standard browser form redirects

            // Retrieve the submit button and show standard sending indicators
            const submitBtn = contactForm.querySelector('.btn-submit');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Form data structured to exactly match Google Apps Script parameters
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            // Post values to your Google Sheet receiver
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors', // Solves standard CORS lock warnings on browser-side calls
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(() => {
                // Successfully received: display confirmation, clear input states
                contactForm.classList.add('hidden');
                formSuccessMsg.classList.remove('hidden');
                contactForm.reset();
            })
            .catch(error => {
                console.error('Submission error details:', error);
                alert('We encountered a problem sending your message. Please try again.');
                
                // Re-enable interactive elements on network failure
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            });
        });
    }
});