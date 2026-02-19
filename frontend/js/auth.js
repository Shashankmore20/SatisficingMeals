import { api } from "./api.js";

export function initAuth(onLogin) {
  const loginForm = document.getElementById("login");
  const signupForm = document.getElementById("signup");
  const showSignup = document.getElementById("show-signup");
  const showLogin = document.getElementById("show-login");
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");

  showSignup.addEventListener("click", () => {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("signup-form").classList.remove("hidden");
  });

  showLogin.addEventListener("click", () => {
    document.getElementById("signup-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const user = await api.login({ username, password });
      onLogin(user);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove("hidden");
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    signupError.classList.add("hidden");
    const name = document.getElementById("signup-name").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    const goal = document.getElementById("signup-goal").value.trim();

    try {
      const user = await api.signup({ name, username, password, goal });
      onLogin(user);
    } catch (err) {
      signupError.textContent = err.message;
      signupError.classList.remove("hidden");
    }
  });
}
