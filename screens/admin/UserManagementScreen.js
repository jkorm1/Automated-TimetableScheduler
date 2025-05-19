"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Card } from "react-native-paper"
import { auth, db } from "../../firebaseConfig"
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
} from "firebase/firestore"
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
 
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

const UserManagementScreen = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("student")
  const [program, setProgram] = useState("")
  const [programs, setPrograms] = useState([])

  useEffect(() => {
    fetchUsers()
    fetchPrograms()
  }, [])

  const fetchPrograms = async () => {
    try {
      const programsRef = collection(db, "programs")
      const programsSnapshot = await getDocs(programsRef)

      const programsList = []
      programsSnapshot.forEach((doc) => {
        programsList.push({
          id: doc.id,
          name: doc.data().name,
        })
      })

      setPrograms(programsList)
    } catch (error) {
      console.error("Error fetching programs:", error)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      const usersRef = collection(db, "users")
      const q = query(usersRef, orderBy("name"))
      const querySnapshot = await getDocs(q)

      const usersList = []

      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data()

        // Get additional data based on role
        const additionalData = {}

        if (userData.role === "student") {
          const studentRef = collection(db, "students")
          const studentQuery = query(studentRef, where("user_id", "==", userDoc.id))
          const studentSnapshot = await getDocs(studentQuery)

          if (!studentSnapshot.empty) {
            const studentData = studentSnapshot.docs[0].data()

            // Get program name
            if (studentData.program_id) {
              const programDoc = doc(db, "programs", studentData.program_id)
              const programSnapshot = await getDoc(programDoc)

              if (programSnapshot.exists()) {
                additionalData.program = programSnapshot.data().name
                additionalData.programId = studentData.program_id
              }
            }
          }
        } else if (userData.role === "lecturer") {
          const lecturerRef = collection(db, "lecturers")
          const lecturerQuery = query(lecturerRef, where("user_id", "==", userDoc.id))
          const lecturerSnapshot = await getDocs(lecturerQuery)

          if (!lecturerSnapshot.empty) {
            additionalData.lecturerId = lecturerSnapshot.docs[0].id
          }
        }

        usersList.push({
          id: userDoc.id,
          ...userData,
          ...additionalData,
        })
      }

      setUsers(usersList)
    } catch (error) {
      console.error("Error fetching users:", error)
      Alert.alert("Error", "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!name || !email || !role) {
      Alert.alert("Error", "Please fill in all required fields")
      return
    }

    if (role === "student" && !program) {
      Alert.alert("Error", "Please select a program for the student")
      return
    }

    try {
      setLoading(true)

      // Generate a random password
      const tempPassword = Math.random().toString(36).slice(-8)

      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword)
      const userId = userCredential.user.uid

      // Add user to Firestore
      await addDoc(collection(db, "users"), {
        id: userId,
        name,
        email,
        role,
        created_at: serverTimestamp(),
        created_by: auth.currentUser.uid,
      })

      // Add role-specific data
      if (role === "student") {
        await addDoc(collection(db, "students"), {
          user_id: userId,
          program_id: program,
          enrollment_date: serverTimestamp(),
        })
      } else if (role === "lecturer") {
        await addDoc(collection(db, "lecturers"), {
          user_id: userId,
          department: "General",
          joined_date: serverTimestamp(),
        })
      }

      // Send password reset email so user can set their own password
      await sendPasswordResetEmail(auth, email)

      Alert.alert("Success", `User created successfully. A password reset email has been sent to ${email}.`)

      // Reset form and refresh users
      resetForm()
      fetchUsers()
    } catch (error) {
      console.error("Error adding user:", error)
      Alert.alert("Error", error.message || "Failed to create user")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!name || !email || !role) {
      Alert.alert("Error", "Please fill in all required fields")
      return
    }

    if (role === "student" && !program) {
      Alert.alert("Error", "Please select a program for the student")
      return
    }

    try {
      setLoading(true)

      // Update user in Firestore
      const userDocRef = doc(db, "users", editingUser.id)
      await updateDoc(userDocRef, {
        name,
        role,
        updated_at: serverTimestamp(),
      })

      // Handle role change if needed
      if (editingUser.role !== role) {
        // If changing from student to another role, remove student record
        if (editingUser.role === "student") {
          const studentRef = collection(db, "students")
          const studentQuery = query(studentRef, where("user_id", "==", editingUser.id))
          const studentSnapshot = await getDocs(studentQuery)

          if (!studentSnapshot.empty) {
            await deleteDoc(doc(db, "students", studentSnapshot.docs[0].id))
          }
        }

        // If changing from lecturer to another role, remove lecturer record
        if (editingUser.role === "lecturer") {
          const lecturerRef = collection(db, "lecturers")
          const lecturerQuery = query(lecturerRef, where("user_id", "==", editingUser.id))
          const lecturerSnapshot = await getDocs(lecturerQuery)

          if (!lecturerSnapshot.empty) {
            await deleteDoc(doc(db, "lecturers", lecturerSnapshot.docs[0].id))
          }
        }

        // If changing to student, add student record
        if (role === "student") {
          await addDoc(collection(db, "students"), {
            user_id: editingUser.id,
            program_id: program,
            enrollment_date: serverTimestamp(),
          })
        }

        // If changing to lecturer, add lecturer record
        if (role === "lecturer") {
          await addDoc(collection(db, "lecturers"), {
            user_id: editingUser.id,
            department: "General",
            joined_date: serverTimestamp(),
          })
        }
      } else if (role === "student" && editingUser.programId !== program) {
        // Update student's program if it changed
        const studentRef = collection(db, "students")
        const studentQuery = query(studentRef, where("user_id", "==", editingUser.id))
        const studentSnapshot = await getDocs(studentQuery)

        if (!studentSnapshot.empty) {
          await updateDoc(doc(db, "students", studentSnapshot.docs[0].id), {
            program_id: program,
          })
        }
      }

      Alert.alert("Success", "User updated successfully")

      // Reset form and refresh users
      resetForm()
      fetchUsers()
    } catch (error) {
      console.error("Error updating user:", error)
      Alert.alert("Error", "Failed to update user")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this user? This action cannot be undone.", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)

            // Get user data to check role
            const userDocRef = doc(db, "users", userId)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userData = userDoc.data()

              // Delete role-specific records
              if (userData.role === "student") {
                const studentRef = collection(db, "students")
                const studentQuery = query(studentRef, where("user_id", "==", userId))
                const studentSnapshot = await getDocs(studentQuery)

                if (!studentSnapshot.empty) {
                  await deleteDoc(doc(db, "students", studentSnapshot.docs[0].id))
                }
              } else if (userData.role === "lecturer") {
                const lecturerRef = collection(db, "lecturers")
                const lecturerQuery = query(lecturerRef, where("user_id", "==", userId))
                const lecturerSnapshot = await getDocs(lecturerQuery)

                if (!lecturerSnapshot.empty) {
                  await deleteDoc(doc(db, "lecturers", lecturerSnapshot.docs[0].id))
                }
              }

              // Delete user document
              await deleteDoc(userDocRef)

              // Note: We can't delete the user from Firebase Authentication directly from client
              // This would typically be handled by a Cloud Function

              Alert.alert("Success", "User deleted successfully")
              fetchUsers()
            }
          } catch (error) {
            console.error("Error deleting user:", error)
            Alert.alert("Error", "Failed to delete user")
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  const resetForm = () => {
    setEditingUser(null)
    setName("")
    setEmail("")
    setRole("student")
    setProgram("")
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setName(user.name)
    setEmail(user.email)
    setRole(user.role)
    setProgram(user.programId || "")
    setModalVisible(true)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const sendPasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
      Alert.alert("Success", "Password reset email sent successfully")
    } catch (error) {
      console.error("Error sending password reset:", error)
      Alert.alert("Error", "Failed to send password reset email")
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const renderUserItem = ({ item }) => {
    return (
      <Card style={styles.userCard}>
        <Card.Content>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{item.name}</Text>
            <View style={styles.userActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={20} color="#0066cc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteUser(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#cc0000" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.userDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="mail-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>{item.email}</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>Role: {item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Text>
            </View>

            {item.role === "student" && item.program && (
              <View style={styles.detailItem}>
                <Ionicons name="school-outline" size={16} color="#666666" />
                <Text style={styles.detailText}>Program: {item.program}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={() => sendPasswordReset(item.email)}>
            <Text style={styles.resetButtonText}>Send Password Reset</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading && !modalVisible ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : filteredUsers.length > 0 ? (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#cccccc" />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Add a user to get started</Text>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingUser ? "Edit User" : "Add New User"}</Text>

            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!editingUser} // Can't edit email for existing users
            />

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>User Role:</Text>
              <View style={styles.roleButtons}>
                {["student", "lecturer", "admin"].map((roleOption) => (
                  <TouchableOpacity
                    key={roleOption}
                    style={[styles.roleButton, role === roleOption && styles.roleButtonActive]}
                    onPress={() => setRole(roleOption)}
                  >
                    <Text style={[styles.roleButtonText, role === roleOption && styles.roleButtonTextActive]}>
                      {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {role === "student" && (
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Program:</Text>
                <View style={styles.programPicker}>
                  {programs.map((prog) => (
                    <TouchableOpacity
                      key={prog.id}
                      style={[styles.programButton, program === prog.id && styles.programButtonActive]}
                      onPress={() => setProgram(prog.id)}
                    >
                      <Text style={[styles.programButtonText, program === prog.id && styles.programButtonTextActive]}>
                        {prog.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingUser ? handleUpdateUser : handleAddUser}
              >
                <Text style={styles.saveButtonText}>{editingUser ? "Update" : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.secondary,
  },
  addButton: {
    backgroundColor: COLORS.secondary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
    color: COLORS.primary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.text,
  },
  loader: {
    marginTop: 32,
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  userActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
  },
  userDetails: {
    marginTop: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: "#e6ffe6",
    padding: 8,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  resetButtonText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textLight,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 16,
    elevation: 5,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  input: {
    height: 50,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginHorizontal: 4,
    borderRadius: 4,
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    color: COLORS.text,
  },
  roleButtonTextActive: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
  programPicker: {
    flexDirection: "column",
  },
  programButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 4,
    borderRadius: 4,
  },
  programButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  programButtonText: {
    color: COLORS.text,
  },
  programButtonTextActive: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalButton: {
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

export default UserManagementScreen

