# Accounts and sync: preview and how it works

Screenshots are from the real app, with a stand-in for Supabase. The flow chart below is the same as `flow.png`.

| Sign in | Create account | Signed in (green dot = saved) | Account menu |
|---|---|---|---|
| ![](1-sign-in.png) | ![](2-create-account.png) | ![](3-signed-in.png) | ![](4-account-menu.png) |

| Phone sign-in | Keep cards already on this phone | Synced |
|---|---|---|
| ![](5-phone-sign-in.png) | ![](6-phone-keep-cards.png) | ![](7-phone-synced.png) |

```mermaid
flowchart TD
  A([Collector opens Tradéx<br/>website or app]) --> B{Signed in<br/>on this device?}
  B -- No --> C[Sign-in screen<br/>email + password, email link,<br/>Google or Apple]
  C --> D{New account?}
  D -- Yes --> E[Create account<br/>Supabase Auth]
  D -- No --> F[Sign in<br/>Supabase Auth]
  E --> G
  F --> G[Download the account's<br/>cards, binders and photos]
  B -- Yes --> G
  G --> H{Cards already in<br/>this browser?}
  H -- Yes --> I[Ask: add them<br/>to your account?]
  H -- No --> J
  I --> J[Collection on screen<br/>copy kept on the device]
  J --> K[Collector adds, edits<br/>or deletes a card]
  K --> L[Saved on the device instantly]
  L --> M[About a second later, changes<br/>upload to Supabase]
  M --> N[(Supabase Postgres<br/>cards · binders · profiles<br/>private to each account)]
  L -. photos .-> P[(Photo storage<br/>card-images bucket)]
  N --> O[Other devices pull changes<br/>when opened, focused or back online]
  O --> J
  N --> Q[Later: market data and<br/>collection analytics<br/>read the same tables]
  L -. offline .-> R[Kept on the device and<br/>sent when back online]
  R --> M
```

## Sign up first, verify later

New accounts go straight into the app. Right after sign-up Tradéx emails a verification link, and a bar at the bottom of the app asks the person to open it (with **Resend**). Opening the link signs them in and records the address as verified (`tx_verified` on the account), and the bar goes away. Google and Apple accounts count as verified already.

Two settings in the Supabase dashboard make this work:

1. **Authentication → Sign In / Providers → Email → Confirm email: off.** With it on, Supabase refuses to sign anyone in until they confirm, so sign-up falls back to the old "check your email" screen.
2. **Authentication → Emails → Magic Link** (optional): the verification email uses this template. Change the subject to something like "Verify your Tradéx email" and the button text to "Verify email" so it reads as a verification rather than a sign-in link.

Supabase's built-in mailer only sends a few emails an hour, so set up custom SMTP (Authentication → Emails → SMTP Settings) before launch.
