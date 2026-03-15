import { registerUser, setCurrentUser } from '../Core/Auth.js';
import { updateItem, initUsers, removeLS } from '../Core/Storage.js';
import { KEY_USERS, KEY_CURRENT_USER } from '../Core/Constants.js';

$(document).ready(async function () {

  await initUsers(); // ← load MockAPI cache first

  // Password toggle
  $("#togglePassword").on("click", function () {
    const $input = $("#password");
    const type = $input.attr("type") === "password" ? "text" : "password";
    $input.attr("type", type);
    $(this).find("i").toggleClass("bi-eye bi-eye-slash");
  });

  // ── chips selection handlers
  function initChipGrid(gridSelector, inputSelector) {
    const $grid = $(gridSelector);
    const $hidden = $(inputSelector);
    function sync() {
      const vals = $grid.find('.chip.selected').map(function () { return $(this).data('value'); }).get();
      $hidden.val(vals.join(','));
    }
    $grid.on('click', '.chip', function () { $(this).toggleClass('selected'); sync(); });
    sync();
  }

  initChipGrid('#categoriesChips', '#categories');
  initChipGrid('#interestsChips', '#interests');

  $("#registerForm").on("submit", function (e) {
    e.preventDefault();

    const name       = $("#name").val().trim();
    const email      = $("#email").val().trim();
    const password   = $("#password").val();
    const city       = $("#city").val()?.trim() || null;
    const categories = $("#categories").val() ? $("#categories").val().split(",").filter(Boolean) : [];
    const interests  = $("#interests").val()  ? $("#interests").val().split(",").filter(Boolean)  : [];

    const result = registerUser(name, email, password);

    if (!result.success) {
      alert(result.error || "Registration failed. Please try again.");
      if (result.error?.includes("Email"))    $("#email").focus().select();
      else if (result.error?.includes("Password")) $("#password").val("").focus().select();
      else if (result.error?.includes("Name"))     $("#name").focus().select();
      return;
    }

    const newUser = result.user;
    const extraData = { city, categories, interests };

    // Merge extra data into the user object for MockAPI
    const enrichedUser = { ...newUser, ...extraData };

    // Update MockAPI cache
    updateItem(KEY_USERS, newUser.id, extraData);

    // Clear any existing session first, then set the new one
    removeLS(KEY_CURRENT_USER);
    setCurrentUser(enrichedUser);

    console.log('ls_currentUser after set:', localStorage.getItem('ls_currentUser'));

    alert(`Welcome, ${newUser.name}! Account created.`);
    this.reset();
    window.location.replace("/Html/Customer/CustomerHomePage.html");
  });

});