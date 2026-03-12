// JS/Customer/Register.js

import { registerUser, setCurrentUser } from '../Core/Auth.js';

$(document).ready(function () {

  // Password toggle — unchanged, works perfectly
  $("#togglePassword").on("click", function () {
    const $input = $("#password");
    const type = $input.attr("type") === "password" ? "text" : "password";
    $input.attr("type", type);
    $(this).find("i").toggleClass("bi-eye bi-eye-slash");
  });

  // ── chips selection handlers ─────────────────────────────────────────
  function initChipGrid(gridSelector, inputSelector) {
    const $grid = $(gridSelector);
    const $hidden = $(inputSelector);

    function sync() {
      const vals = $grid
        .find('.chip.selected')
        .map(function () { return $(this).data('value'); })
        .get();
      $hidden.val(vals.join(','));
    }

    $grid.on('click', '.chip', function () {
      $(this).toggleClass('selected');
      sync();
    });

    // initialize on load (in case browser restores state)
    sync();
  }

  initChipGrid('#categoriesChips', '#categories');
  initChipGrid('#interestsChips', '#interests');

  $("#registerForm").on("submit", function (e) {
    e.preventDefault();

    const name = $("#name").val().trim();
    const email = $("#email").val().trim();
    const password = $("#password").val();
    const city = $("#city").val()?.trim() || null;

    // ✅ FIX 2: chips write to a hidden input as comma-separated string
    const categories = $("#categories").val()
      ? $("#categories").val().split(",").filter(Boolean)
      : [];

    const interests = $("#interests").val()
      ? $("#interests").val().split(",").filter(Boolean)
      : [];

    const result = registerUser(name, email, password);

    if (!result.success) {
      alert(result.error || "Registration failed. Please try again.");

      if (result.error?.includes("Email")) $("#email").focus().select();
      else if (result.error?.includes("Password")) $("#password").val("").focus().select();
      else if (result.error?.includes("Name")) $("#name").focus().select();

      return;
    }

    const newUser = result.user;

    // ✅ FIX 3: save city, categories, interests into localStorage
    const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
    const idx   = users.findIndex(u => u.id === newUser.id);
    if (idx !== -1) {
      users[idx].city       = city;
      users[idx].categories = categories;
      users[idx].interests  = interests;
      localStorage.setItem('ls_users', JSON.stringify(users));

      // ✅ Set the enriched user (with city/categories/interests) as current
      setCurrentUser(users[idx]);
    }


    alert(`Welcome, ${newUser.name || newUser.email.split('@')[0]}! Account created.`);

    this.reset();

    window.location.href = "/Html/Customer/CustomerHomePage.html";
  });

});