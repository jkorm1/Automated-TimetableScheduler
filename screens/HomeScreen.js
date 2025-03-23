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
import ProfileScreen from "./ProfileScreen"
import UserManagementScreen from "./admin/UserManagementScreen"
import GeneratorScreen from "./GeneratorScreen"
import ProgramManagementScreen from "./admin/ProgramManagementScreen"
import CourseManagementScreen from "./admin/CourseManagementScreen"

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
            iconName = focused ? "cog" : "cog-outline"
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline"
          } else if (route.name === "Users") {
            iconName = focused ? "people" : "people-outline"
          }else if (route.name === "Courses") {
            iconName = focused ? "book" : "book-outline"; // 📖
          } else if (route.name === "Programs") {
            iconName = focused ? "school" : "school-outline"; // 🎓
          }
          

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#0066cc",
        tabBarInactiveTintColor: "gray",
        headerShown: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} initialParams={{ userRole }} options={{ headerShown: false }}  />
      <Tab.Screen name="Timetable" component={TimetableScreen} initialParams={{ userRole }} />

      {(userRole === "student" || userRole === "lecturer") && (
        <Tab.Screen name="Attendance" component={AttendanceScreen} initialParams={{ userRole }} />
      )}

      {userRole === "admin" && <Tab.Screen name="Rooms" component={RoomsScreen} options={{ headerShown: false }} />}
      {userRole === "admin" && <Tab.Screen name="Generator" component={GeneratorScreen} options={{ headerShown: false }} />}
      {userRole === "admin" && <Tab.Screen name="Users" component={UserManagementScreen} options={{ headerShown: false }} />}
      {userRole === "admin" && <Tab.Screen name="Courses" component={CourseManagementScreen} options={{ headerShown: false }} />}
      {userRole === "admin" && <Tab.Screen name="Programs" component={ProgramManagementScreen}  options={{ headerShown: false }}  />}

      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen} initialParams={{ userRole }} options={{ headerShown: false }} />
    </Tab.Navigator>
  )
}

export default HomeScreen

