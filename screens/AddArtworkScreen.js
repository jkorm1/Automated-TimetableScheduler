import { useState } from "react"
import { View, TextInput, Button, StyleSheet, Alert } from "react-native"
import { auth, db } from "../firebaseConfig"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"

export default function AddArtworkScreen({ navigation }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  const handleAddArtwork = async () => {
    if (!title || !imageUrl) {
      Alert.alert("Error", "Please provide a title and image URL for your artwork.")
      return
    }

    try {
      const userDoc = doc(db, "artists", auth.currentUser.uid)
      await updateDoc(userDoc, {
        artworks: arrayUnion({
          id: Date.now().toString(),
          title,
          description,
          imageUrl,
        }),
      })
      Alert.alert("Success", "Artwork added successfully!")
      navigation.goBack()
    } catch (error) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Artwork Title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Image URL" value={imageUrl} onChangeText={setImageUrl} />
      <TextInput
        style={[styles.input, styles.descriptionInput]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Button title="Add Artwork" onPress={handleAddArtwork} />
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
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
  },
})

