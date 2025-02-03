import { useState, useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { auth } from "./firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"

import HomeScreen from "./screens/HomeScreen"
import ArtistDetailScreen from "./screens/ArtistDetailScreen"
import LoginScreen from "./screens/LoginScreen"
import SignUpScreen from "./screens/SignUpScreen"
import MyProfileScreen from "./screens/MyProfileScreen"
import EditProfileScreen from "./screens/EditProfileScreen"
import AddArtworkScreen from "./screens/AddArtworkScreen"

const Stack = createNativeStackNavigator()

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
    })

    return unsubscribe
  }, [])

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "The Artisan" }} />
            <Stack.Screen
              name="ArtistDetail"
              component={ArtistDetailScreen}
              options={({ route }) => ({ title: route.params.artistName })}
            />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: "My Shop" }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
            <Stack.Screen name="AddArtwork" component={AddArtworkScreen} options={{ title: "Add New Artwork" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

