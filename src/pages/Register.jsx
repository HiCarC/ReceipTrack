import React, { useEffect, useState } from "react";
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";

export default function Register() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const auth = getAuth();
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');
      if (!emailForSignIn) {
        setStatus("needEmail");
      } else {
        setEmail(emailForSignIn);
        signInWithEmailLink(auth, emailForSignIn, window.location.href)
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            setStatus("success");
            // Optionally: Add user to group here, show onboarding, etc.
          })
          .catch((err) => {
            setError(err.message);
            setStatus("error");
          });
      }
    } else {
      setStatus("noLink");
    }
  }, []);

  // If user opened the link on a different device, ask for their email
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const auth = getAuth();
    setStatus("loading");
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      setStatus("success");
      // Optionally: Add user to group here, show onboarding, etc.
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (status === "loading") return <div className="p-8 text-center">Checking magic link...</div>;
  if (status === "success") return <div className="p-8 text-center text-green-600">Welcome! You are now registered and signed in. 🎉</div>;
  if (status === "error") return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  if (status === "noLink") return <div className="p-8 text-center">Invalid or expired link.</div>;
  if (status === "needEmail") {
    return (
      <form className="p-8 text-center" onSubmit={handleEmailSubmit}>
        <h2 className="text-xl font-bold mb-4">Enter your email to complete registration</h2>
        <input
          className="rounded px-4 py-2 border"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button className="ml-2 px-4 py-2 bg-blue-600 text-white rounded" type="submit">
          Complete Sign-In
        </button>
      </form>
    );
  }
  return null;
} 