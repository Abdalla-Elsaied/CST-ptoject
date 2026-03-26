import { registerUser, setCurrentUser } from '../Core/Auth.js';
import { updateItem, initUsers, removeLS } from '../Core/Storage.js';
import { KEY_USERS, KEY_CURRENT_USER } from '../Core/Constants.js';

/* ─────────────────────────────────────────────────────────
   Toast notification system
   Usage:
     showToast('error',   'Title', 'Message')
     showToast('success', 'Title', 'Message')
───────────────────────────────────────────────────────── */
function ensureToastShelf() {
    let $shelf = $('#toastShelf');
    if (!$shelf.length) {
        $shelf = $('<div id="toastShelf" class="toast-shelf"></div>').appendTo('body');
    }
    return $shelf;
}

function showToast(type, title, message, duration = type === 'error' ? 5000 : 3000) {
    const $shelf = ensureToastShelf();

    const iconMap = {
        error:   'bi-exclamation-circle-fill',
        success: 'bi-check-circle-fill',
    };

    const $toast = $(`
        <div class="toast-notif toast-${type}" role="alert" aria-live="assertive">
            <div class="toast-icon">
                <i class="bi ${iconMap[type] ?? 'bi-info-circle-fill'}"></i>
            </div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <button class="toast-close" aria-label="Dismiss">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `).appendTo($shelf);

    function dismiss() {
        $toast.addClass('leaving');
        setTimeout(() => $toast.remove(), 340);
    }

    $toast.find('.toast-close').on('click', dismiss);
    setTimeout(dismiss, duration);
}

/* ─────────────────────────────────────────────────────────
   Welcome overlay — shown after successful registration
───────────────────────────────────────────────────────── */
function showWelcome(name, onDone) {
    const $overlay = $(`
        <div class="welcome-overlay" role="dialog" aria-modal="true" aria-label="Account created">
            <div class="welcome-card">
                <div class="welcome-avatar">🎉</div>
                <h3>Welcome, <span class="welcome-name">${name}</span>!</h3>
                <p class="welcome-sub">
                    Your account has been created successfully.<br>
                    Taking you to your dashboard…
                </p>
                <div class="welcome-progress-wrap">
                    <div class="welcome-progress-bar">
                        <div class="welcome-progress-fill"></div>
                    </div>
                    <span class="welcome-progress-label">Redirecting…</span>
                </div>
            </div>
        </div>
    `).appendTo('body');

    // Redirect when the progress animation ends (~1.8s)
    setTimeout(() => {
        onDone();
    }, 1850);
}

/* ─────────────────────────────────────────────────────────
   Main
───────────────────────────────────────────────────────── */
$(document).ready(async function () {

    await initUsers();

    // ── Password toggle ──────────────────────────────────
    $("#togglePassword").on("click", function () {
        const $input = $("#password");
        const type = $input.attr("type") === "password" ? "text" : "password";
        $input.attr("type", type);
        $(this).find("i").toggleClass("bi-eye bi-eye-slash");
    });

    // ── Chip grids ───────────────────────────────────────
    function initChipGrid(gridSelector, inputSelector) {
        const $grid   = $(gridSelector);
        const $hidden = $(inputSelector);
        function sync() {
            const vals = $grid.find('.chip.selected')
                .map(function () { return $(this).data('value'); }).get();
            $hidden.val(vals.join(','));
        }
        $grid.on('click', '.chip', function () { $(this).toggleClass('selected'); sync(); });
        sync();
    }

    initChipGrid('#categoriesChips', '#categories');
    initChipGrid('#interestsChips',  '#interests');

    // ── Form submit ──────────────────────────────────────
    $("#registerForm").on("submit", function (e) {
        e.preventDefault();

        const name       = $("#name").val().trim();
        const email      = $("#email").val().trim();
        const password   = $("#password").val();
        const city       = $("#city").val()?.trim() || null;
        const categories = $("#categories").val()
            ? $("#categories").val().split(",").filter(Boolean) : [];
        const interests  = $("#interests").val()
            ? $("#interests").val().split(",").filter(Boolean)  : [];

        const result = registerUser(name, email, password);

        if (!result.success) {
            // Map the error to a friendly message + focus the right field
            let friendlyMsg = result.error ?? 'Please check the form and try again.';

            if (result.error?.includes("Email")) {
                showToast('error', 'Email already in use', 'Try a different email address or sign in instead.');
                $("#email").focus().select();
            } else if (result.error?.includes("Password")) {
                showToast('error', 'Password too short', friendlyMsg);
                $("#password").val("").focus().select();
            } else if (result.error?.includes("Name")) {
                showToast('error', 'Name is required', friendlyMsg);
                $("#name").focus().select();
            } else {
                showToast('error', 'Registration failed', friendlyMsg);
            }
            return;
        }

        // ── Success path ─────────────────────────────────
        const newUser      = result.user;
        const extraData    = { city, categories, interests };
        const enrichedUser = { ...newUser, ...extraData };

        updateItem(KEY_USERS, newUser.id, extraData);
        removeLS(KEY_CURRENT_USER);
        setCurrentUser(enrichedUser);

        // Disable the submit button to prevent double-submission
        $(".btn-submit").prop("disabled", true).css("opacity", 0.7);

        showWelcome(newUser.name, () => {
            this.reset();
            window.location.replace("/Html/Customer/CustomerHomePage.html");
        });
    });

});