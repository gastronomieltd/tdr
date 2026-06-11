document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // Mobile Navigation Hamburger Menu Toggle
    // ==========================================
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinksList = document.querySelectorAll('.nav-link');

    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        // Prevent body scrolling when mobile menu is open
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    };

    const closeMenu = () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    };

    hamburger.addEventListener('click', toggleMenu);

    // Close menu when clicking on nav link
    navLinksList.forEach(link => {
        link.addEventListener('click', closeMenu);
    });


    // ==========================================
    // Dynamic Menu Tab Switcher
    // ==========================================
    const tabButtons = document.querySelectorAll('.menu-tab');
    const menuCategories = document.querySelectorAll('.menu-category');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and sections
            tabButtons.forEach(btn => btn.classList.remove('active'));
            menuCategories.forEach(cat => cat.classList.remove('active'));

            // Add active class to selected button and category
            button.classList.add('active');
            
            const activeCategory = document.getElementById(targetTab);
            if (activeCategory) {
                activeCategory.classList.add('active');
            }
        });
    });


    // ==========================================
    // Active Link Highlight on Scroll (Scrollspy)
    // ==========================================
    const sections = document.querySelectorAll('section');

    const scrollSpy = () => {
        const scrollPosition = window.scrollY + 120; // Added offset to match sticky nav behavior

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


    // ==========================================
    // Contact Form In-App Submission Feedback
    // ==========================================
    const contactForm = document.getElementById('contactForm');
    const formSuccessMsg = document.getElementById('formSuccess');

    if (contactForm && formSuccessMsg) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Stop page reload

            // Retrieve form field values (ready for later integration with backend APIs)
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            // Simulate form submission effect
            contactForm.classList.add('hidden');
            formSuccessMsg.classList.remove('hidden');

            // Reset Form Fields after simulated delay
            setTimeout(() => {
                contactForm.reset();
            }, 500);
        });
    }
});