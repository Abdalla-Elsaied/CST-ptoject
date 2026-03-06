// JS/Customer/Register.js  (or similar path)

import {
  registerUser,
  ROLES
} from '../Core/Auth.js';

// Wait for DOM and jQuery to be ready
$(document).ready(function () {

  // Password visibility toggle (kept as-is — good UX)
  $("#togglePassword").on("click", function () {
    const $input = $("#password");
    const type = $input.attr("type") === "password" ? "text" : "password";
    $input.attr("type", type);
    $(this).find("i").toggleClass("bi-eye bi-eye-slash");
  });

  // Form submission
  $("#registerForm").on("submit", function (e) {
    e.preventDefault();

    // Bootstrap validation
    if (!this.checkValidity()) {
      e.stopPropagation();
      $(this).addClass("was-validated");
      return;
    }

    // Collect form values
    const name     = $("#name").val().trim();
    const email    = $("#email").val().trim();
    const password = $("#password").val();

    // Optional extra fields (if they exist in your form)
    const city       = $("#city").val()?.trim() || null;
    const categories = $("#categories").val() || [];     // assuming <select multiple> or comma-separated
    const interests  = $("#interests").val() || [];

    // ────────────────────────────────────────────────
    // Use auth.js — this is the correct & only allowed way
    // ────────────────────────────────────────────────
    const result = registerUser(name, email, password);

    if (!result.success) {
      alert(result.error || "Registration failed. Please try again.");
      
      if (result.error?.includes("Email")) {
        $("#email").focus().select();
      } else if (result.error?.includes("Password")) {
        $("#password").val("").focus().select();
      } else if (result.error?.includes("Name")) {
        $("#name").focus().select();
      }
      
      return;
    }

    // Registration successful — we have a new customer
    const newUser = result.user;

    // Success feedback
    alert(`Registration successful! Welcome, ${newUser.name || newUser.email.split('@')[0]}!`);

    // Reset form & validation
    this.reset();
    $(this).removeClass("was-validated");

    // Redirect to customer home
    window.location.href = "/Html/Customer/Home.html";
  });
});