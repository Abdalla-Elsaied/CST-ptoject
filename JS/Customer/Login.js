// /JS/Customer/Login.js

import {
  loginUser,
  getCurrentUser,
  ROLES
} from '../Core/Auth.js';  

// Wait for DOM and jQuery to be ready
$(document).ready(function () {

  // Password visibility toggle (unchanged – nice UX)
  $("#togglePassword").on("click", function () {
    const $input = $("#floatingPassword");
    const type = $input.attr("type") === "password" ? "text" : "password";
    $input.attr("type", type);
    $(this).find("i").toggleClass("bi-eye bi-eye-slash");
  });

  // Login form submission
  $("#loginForm").on("submit", function (e) {
    e.preventDefault();

    // Bootstrap form validation
    if (!this.checkValidity()) {
      e.stopPropagation();
      $(this).addClass("was-validated");
      return;
    }

    const email    = $("#floatingEmail").val().trim();
    const password = $("#floatingPassword").val();

    const result = loginUser(email, password);

    if (!result.success) {
      alert(result.error || "Login failed. Please check your credentials.");
      
      if (result.error?.includes("credentials")) {
        $("#floatingPassword").val("").focus().select();
      } else {
        $("#floatingEmail").focus().select();
      }
      return;
    }

    // Login was successful → get the full user object (optional but useful)
    const user = getCurrentUser();

    if (!user) {
      alert("Something went wrong after login. Please try again.");
      return;
    }

    // Optional nice feedback
    const welcomeName = user.name || user.email.split('@')[0];
    alert(`Welcome back, ${welcomeName}!`);

    // ────────────────────────────────────────────────
    // Redirect based on role (you can keep this logic here or move to auth.js)
    // ────────────────────────────────────────────────
    let redirectUrl = null; // fallback

    switch (user.role) {
      case ROLES.ADMIN:
        redirectUrl = "/Html/Admin/admin-panel.html";
        break;
      case ROLES.SELLER:
        redirectUrl = "/Html/Seller/SellerHomePage.html";
        break;
      case ROLES.CUSTOMER:
        redirectUrl = "/Html/Customer/Home.html";
        break;
      default:
        alert("Unknown user role. Contact support.");
        return;
    }

    // Redirect
    window.location.href = redirectUrl;
  });
});