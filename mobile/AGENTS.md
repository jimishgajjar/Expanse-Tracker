# Expo HAS CHANGED

This project runs **Expo SDK 54** (downgraded from the canary SDK 56 so it runs in the
App Store Expo Go). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/
before writing any code.

Note: `.npmrc` sets `legacy-peer-deps=true` because `@react-native-community/datetimepicker`
declares an optional `react-native-windows` peer that otherwise breaks `npm install`.
