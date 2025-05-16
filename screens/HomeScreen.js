"use client"

import { useState, useEffect } from "react"
import { View, TouchableOpacity, StyleSheet } from "react-native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createDrawerNavigator } from "@react-navigation/drawer"
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
import CustomDrawerContent from "../app/CustomDrawerContent" // We'll create this component

const Tab = createBottomTabNavigator()
const Drawer = createDrawerNavigator()

// This component will contain the bottom tabs
const TabNavigator = ({ userRole }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName

          if (route.name === "Dashboard") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Timetable") {
            iconName = focused ? "calendar" : "calendar-outline"
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline"
          } else if (route.name === "Settings") {
            iconName = focused ? "cog" : "cog-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#0066cc",
        tabBarInactiveTintColor: "gray",
        headerShown: true,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        initialParams={{ userRole }} 
        options={{ headerShown: false }} 
      />
      <Tab.Screen 
        name="Timetable" 
        component={TimetableScreen} 
        initialParams={{ userRole }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ headerShown: false }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        initialParams={{ userRole }} 
        options={{ headerShown: false }} 
      />
    </Tab.Navigator>
  )
}

// Custom header button to open drawer
const DrawerButton = ({ navigation }) => {
  return (
    <TouchableOpacity 
      style={styles.drawerButton}
      onPress={() => navigation.openDrawer()}
    >
      <Ionicons name="menu" size={24} color="#0066cc" />
    </TouchableOpacity>
  )
}

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
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} userRole={userRole} />}
      screenOptions={({ navigation }) => ({
        headerLeft: () => <DrawerButton navigation={navigation} />,
      })}
    >
      <Drawer.Screen 
        name="MainTabs" 
        options={{ 
          title: "UniScheduler",
          headerTitle: "UniScheduler"
        }}
      >
        {props => <TabNavigator {...props} userRole={userRole} />}
      </Drawer.Screen>
      
      {/* Role-specific screens - these won't appear in tabs but are accessible from drawer */}
      {(userRole === "student" || userRole === "lecturer") && (
        <Drawer.Screen 
          name="Attendance" 
          component={AttendanceScreen} 
          initialParams={{ userRole }}
          options={{ 
            drawerIcon: ({ color, size }) => (
              <Ionicons name="checkbox-outline" size={size} color={color} />
            )
          }}
        />
      )}
      
      {userRole === "admin" && (
        <>
          <Drawer.Screen 
            name="Rooms" 
            component={RoomsScreen} 
            options={{ 
              drawerIcon: ({ color, size }) => (
                <Ionicons name="business-outline" size={size} color={color} />
              )
            }}
          />
          <Drawer.Screen 
            name="Generator" 
            component={GeneratorScreen} 
            options={{ 
              drawerIcon: ({ color, size }) => (
                <Ionicons name="settings-outline" size={size} color={color} />
              )
            }}
          />
          <Drawer.Screen 
            name="Users" 
            component={UserManagementScreen} 
            options={{ 
              drawerIcon: ({ color, size }) => (
                <Ionicons name="people-outline" size={size} color={color} />
              )
            }}
          />
          <Drawer.Screen 
            name="Courses" 
            component={CourseManagementScreen} 
            options={{ 
              drawerIcon: ({ color, size }) => (
                <Ionicons name="book-outline" size={size} color={color} />
              )
            }}
          />
          <Drawer.Screen 
            name="Programs" 
            component={ProgramManagementScreen} 
            options={{ 
              drawerIcon: ({ color, size }) => (
                <Ionicons name="school-outline" size={size} color={color} />
              )
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  )
}

const styles = StyleSheet.create({
  drawerButton: {
    marginLeft: 15,
    padding: 5,
  }
})

export default HomeScreen