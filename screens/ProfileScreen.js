"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Card } from "react-native-paper"
import { auth, db, storage } from "../firebaseConfig"
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateEmail } from "firebase/auth"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import * as ImagePicker from "expo-image-picker"

// KNUST color theme
const COLORS = {
  primary: "#006400", // Dark green
  secondary: "#FFD700", // Gold/Yellow
  background: "#F5F5F5",
  cardBackground: "#FFFFFF",
  text: "#333333",
  textLight: "#666666",
  accent: "#008000", // Medium green
  border: "#E0E0E0",
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  info: "#2196F3",
}

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Profile data
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [profileImage, setProfileImage] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState("")

  // Password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  // Additional data based on role
  const [programName, setProgramName] = useState("")
  const [department, setDepartment] = useState("")

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)

      const user = auth.currentUser
      if (!user) return

      // Get user data from Firestore
      const userDocRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const data = userDoc.data()

        setUserData(data)
        setName(data.name || "")
        setEmail(user.email || "")
        setProfileImage(data.profileImage || null)
        setPhoneNumber(data.phoneNumber || "")

        // Get additional data based on role
        if (data.role === "student") {
          // Get student data
          const studentRef = collection(db, "students")
          const studentQuery = query(studentRef, where("user_id", "==", user.uid))
          const studentSnapshot = await getDocs(studentQuery)

          if (!studentSnapshot.empty) {
            const studentData = studentSnapshot.docs[0].data()

            // Get program name
            if (studentData.program_id) {
              const programDoc = await getDoc(doc(db, "programs", studentData.program_id))

              if (programDoc.exists()) {
                setProgramName(programDoc.data().name)
              }
            }
          }
        } else if (data.role === "lecturer") {
          // Get lecturer data
          const lecturerRef = collection(db, "lecturers")
          const lecturerQuery = query(lecturerRef, where("user_id", "==", user.uid))
          const lecturerSnapshot = await getDocs(lecturerQuery)

          if (!lecturerSnapshot.empty) {
            const lecturerData = lecturerSnapshot.docs[0].data()
            setDepartment(lecturerData.department || "")
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      Alert.alert("Error", "Failed to load profile data")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!name) {
      Alert.alert("Error", "Name is required")
      return
    }

    try {
      setUpdating(true)

      const user = auth.currentUser
      if (!user) return

      // Update user document in Firestore
      const userDocRef = doc(db, "users", user.uid)

      const updateData = {
        name,
        phoneNumber,
        updated_at: serverTimestamp(),
      }

      await updateDoc(userDocRef, updateData)

      // Update email if changed
      if (email !== user.email) {
        await updateEmail(user, email)
      }

      Alert.alert("Success", "Profile updated successfully")
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", error.message || "Failed to update profile")
    } finally {
      setUpdating(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "All password fields are required")
      return
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords don't match")
      return
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters")
      return
    }

    try {
      setUpdating(true)

      const user = auth.currentUser
      if (!user) return

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, newPassword)

      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowPasswordForm(false)

      Alert.alert("Success", "Password changed successfully")
    } catch (error) {
      console.error("Error changing password:", error)

      let errorMessage = "Failed to change password"
      if (error.code === "auth/wrong-password") {
        errorMessage = "Current password is incorrect"
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Please log out and log back in before changing your password"
      }

      Alert.alert("Error", errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "You need to grant permission to access your photos")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled) {
        setUpdating(true)

        // Upload image to Firebase Storage
        const user = auth.currentUser
        const imageRef = ref(storage, `profile_images/${user.uid}`)

        // Convert image to blob
        const response = await fetch(result.assets[0].uri)
        const blob = await response.blob()

        // Upload blob to Firebase Storage
        await uploadBytes(imageRef, blob)

        // Get download URL
        const downloadURL = await getDownloadURL(imageRef)

        // Update user document with profile image URL
        const userDocRef = doc(db, "users", user.uid)
        await updateDoc(userDocRef, {
          profileImage: downloadURL,
          updated_at: serverTimestamp(),
        })

        setProfileImage(downloadURL)
        setUpdating(false)

        Alert.alert("Success", "Profile picture updated successfully")
      }
    } catch (error) {
      console.error("Error updating profile picture:", error)
      Alert.alert("Error", "Failed to update profile picture")
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.profileImageContainer} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImagePlaceholderText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.editImageButton}>
            <Ionicons name="camera" size={16} color="#ffffff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.userName}>{name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {userData?.role === "student" ? "Student" : userData?.role === "lecturer" ? "Lecturer" : "Admin"}
          </Text>
        </View>

        {userData?.role === "student" && programName && <Text style={styles.programText}>Program: {programName}</Text>}

        {userData?.role === "lecturer" && department && (
          <Text style={styles.programText}>Department: {department}</Text>
        )}
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your full name" />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProfile} disabled={updating}>
            {updating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.updateButtonText}>Update Profile</Text>
            )}
          </TouchableOpacity>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Security</Text>

          {!showPasswordForm ? (
            <TouchableOpacity style={styles.passwordButton} onPress={() => setShowPasswordForm(true)}>
              <Ionicons name="key-outline" size={20} color="#0066cc" style={styles.buttonIcon} />
              <Text style={styles.passwordButtonText}>Change Password</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.passwordButtonsContainer}>
                <TouchableOpacity
                  style={[styles.passwordActionButton, styles.cancelButton]}
                  onPress={() => {
                    setShowPasswordForm(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.passwordActionButton, styles.saveButton]}
                  onPress={handleChangePassword}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.secondary,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileImagePlaceholderText: {
    fontSize: 40,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.secondary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  programText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  card: {
    margin: 16,
    elevation: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: COLORS.cardBackground,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  updateButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
  passwordButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
    color: COLORS.primary,
  },
  passwordButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  passwordButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  passwordActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  saveButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
})

export default ProfileScreen