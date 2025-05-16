"use client"

import { useState, useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { auth } from "./firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"
import { StatusBar } from "react-native"

import HomeScreen from "./screens/HomeScreen"
import LoginScreen from "./screens/LoginScreen"

import 'react-native-gesture-handler'; // Important! Add this at the top of your file

// Rest of your App.js remains the same

const Stack = createNativeStackNavigator()

export default function App() {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      if (initializing) setInitializing(false)
    })

    return unsubscribe
  }, [initializing])

  if (initializing) return null

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                title: "UniScheduler",
                headerShown: false,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

