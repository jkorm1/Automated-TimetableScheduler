import { useState, useEffect } from "react"
import { View, TextInput, Button, StyleSheet, Alert } from "react-native"
import { auth, db } from "../firebaseConfig"
import { doc, updateDoc, getDoc } from "firebase/firestore"

export default function EditProfileScreen({ navigation }) {
  const [name, setName] = useState("")
  const [instagramHandle, setInstagramHandle] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState("")

  useEffect(() => {
    const fetchUserData = async () => {
      const userDoc = doc(db, "artists", auth.currentUser.uid)
      const userSnapshot = await getDoc(userDoc)
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data()
        setName(userData.name)
        setInstagramHandle(userData.instagramHandle)
        setBio(userData.bio)
        setProfileImage(userData.profileImage)
      }
    }

    fetchUserData()
  }, [])

  const handleSave = async () => {
    try {
      const userDoc = doc(db, "artists", auth.currentUser.uid)
      await updateDoc(userDoc, {
        name,
        instagramHandle,
        bio,
        profileImage,
      })
      Alert.alert("Success", "Profile updated successfully!")
      navigation.goBack()
    } catch (error) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Profile Image URL"
        value={profileImage}
        onChangeText={setProfileImage}
      />
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Instagram Handle"
        value={instagramHandle}
        onChangeText={setInstagramHandle}
      />
      <TextInput
        style={[styles.input, styles.bioInput]}
        placeholder="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <Button title="Save Changes" onPress={handleSave} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
})

