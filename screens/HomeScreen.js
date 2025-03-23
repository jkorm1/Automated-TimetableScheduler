"use client"

import { useState, useEffect } from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import { auth, db } from "../firebaseConfig"
import { collection, getDocs, query, where } from "firebase/firestore"

import DashboardScreen from "./DashboardScreen"
import TimetableScreen from "./TimetableScreen"
import AttendanceScreen from "./AttendanceScreen"
import SettingsScreen from "./SettingsScreen"
import RoomsScreen from "./RoomsScreen"

const Tab = createBottomTabNavigator()

const HomeScreen = () => {
  const [userRole, setUserRole] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser
        if (!user) return

        // Get user data from Firestore
        const userRef = collection(db, "users")
        const q = query(userRef, where("email", "==", user.email))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data()
          setUserRole(userData.role || "student")
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  if (loading) return null

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "Dashboard") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Timetable") {
            iconName = focused ? "calendar" : "calendar-outline"
          } else if (route.name === "Attendance") {
            iconName = focused ? "checkbox" : "checkbox-outline"
          } else if (route.name === "Rooms") {
            iconName = focused ? "business" : "business-outline"
          } else if (route.name === "Generator") {
            iconName = focused ? "settings" : "settings-outline"
          } else if (route.name === "Settings") {
            iconName = focused ? "person" : "person-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#0066cc",
        tabBarInactiveTintColor: "gray",
        headerShown: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} initialParams={{ userRole }} />
      <Tab.Screen name="Timetable" component={TimetableScreen} initialParams={{ userRole }} />
      {(userRole === "student" || userRole === "lecturer") && (
        <Tab.Screen name="Attendance" component={AttendanceScreen} initialParams={{ userRole }} />
      )}
      {userRole === "admin" && <Tab.Screen name="Rooms" component={RoomsScreen} />}
      {userRole === "admin" && <Tab.Screen name="Generator" component={GeneratorScreen} />}
      <Tab.Screen name="Settings" component={SettingsScreen} initialParams={{ userRole }} />
    </Tab.Navigator>
  )
}

export default HomeScreen

