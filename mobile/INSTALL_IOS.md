# Installing Expense Tracker on an iPhone

This Expo SDK 54 app is configured for the bundle identifier
`com.jimishgajjar.expensetracker` and the Expo project
`webhost466/expense-tracker`.

An installable iPhone IPA needs an Apple Developer Program team to sign an
internal distribution build. The connected Expo account currently has no Apple
team, so an IPA built without new signing access would not install.

Once an Apple Developer Program membership is available:

1. From `mobile/`, sign in to the Expo account that owns this project.
2. Run `npx eas-cli device:create` and open the registration link on the
   iPhone that will receive the app. Complete device registration before
   building.
3. Run `npx eas-cli build --platform ios --profile preview`. Complete the
   interactive Apple signing prompts in the CLI or Expo dashboard. Do not
   share Apple credentials in chat or commit them to this repository.
4. Download the resulting IPA from the EAS build page and install it on the
   registered iPhone using its install link or Expo Orbit.

For a development preview without an IPA, install Expo Go for SDK 54, run
`npx expo start` in `mobile/`, and scan its QR code while the development
server is running.
