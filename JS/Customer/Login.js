import { loginUser, getCurrentUser, ROLES, showNotif } from '../Core/Auth.js';
import { seedAdmin, seedCategories } from '../Core/SeedData.js';
import { initUsers } from "../Core/Storage.js";
import { getLS, setLS, updateItem } from "../Core/Storage.js"; // ← use your abstraction
import { KEY_USERS } from "../Core/Constants.js";

// ✅ async added here
$(document).ready(async function () {

    await initUsers();  // ① fetch users from MockAPI into cache
    await seedAdmin();        // ② seed defaults if no admin found
    seedCategories();

    // Show ban/suspend message if redirected from requireRole()
    const params = new URLSearchParams(window.location.search);
    if (params.get('banned') === '1') {
    showNotif('Your account has been banned. Please contact support.', 'warning');
    } else if (params.get('suspended') === '1') {
        showNotif('Your seller account has been suspended. Please contact support.', 'warning');
    }

    $('#guestBtn').on('click', function () {
        // Clear only the customer session — leave admin/seller sessions intact
        localStorage.removeItem('ls_currentUser_customer');
        localStorage.removeItem('ls_currentUser');
        window.location.href = '/Html/Customer/CustomerHomePage.html';
    });

    $("#togglePassword").on("click", function () {
        const $input = $("#floatingPassword");
        const type = $input.attr("type") === "password" ? "text" : "password";
        $input.attr("type", type);
        $(this).find("i").toggleClass("bi-eye bi-eye-slash");
    });

    $("#loginForm").on("submit", function (e) {
        e.preventDefault();

        if (!this.checkValidity()) {
            e.stopPropagation();
            $(this).addClass("was-validated");
            return;
        }

        const email    = $("#floatingEmail").val().trim();
        const password = $("#floatingPassword").val();
        const result   = loginUser(email, password);

        if (!result.success) {
            showNotif(result.error || 'Login failed. Please check your credentials.', 'error');
            if (result.error?.includes("credentials")) {
                $("#floatingPassword").val("").focus().select();
            } else {
                $("#floatingEmail").focus().select();
            }
            return;
        }

        const user = getCurrentUser();

        if (!user) {
            showNotif('Something went wrong after login. Please try again.', 'error');
            return;
        }

        // Update last login timestamp
        updateItem(KEY_USERS, user.id, { lastLoginAt: new Date().toISOString() });
        user.lastLoginAt = new Date().toISOString();
        setLS('ls_currentUser', user);

        if (user.role === ROLES.SELLER && user.isApproved === false) {
            showNotif('Your seller account is pending approval. Please wait for admin approval.', 'warning');
            localStorage.removeItem('ls_currentUser');
            return;
        }

        let redirectUrl = null;
        switch (user.role) {
            case ROLES.ADMIN:    redirectUrl = "/Html/Admin/admin-panel.html";          break;
            case ROLES.SELLER:   redirectUrl = "/Html/Seller/SellerHomePage.html";      break;
            case ROLES.CUSTOMER: redirectUrl = "/Html/Customer/CustomerHomePage.html";  break;
            default:
                showNotif('Unknown user role. Contact support.', 'error');
                return;
        }

        const welcomeName = user.name || user.email.split('@')[0];
        showNotif(`Welcome back, ${welcomeName}! Redirecting you now…`, 'success', 1000);
        setTimeout(() => window.location.replace(redirectUrl), 1800);

    });
});

// ── Popup utility (replaces alert) ──────────────────────────────
