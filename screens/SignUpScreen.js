import { useState } from "react"
import { View, TextInput, Button, StyleSheet, Alert } from "react-native"
import { auth, db } from "../firebaseConfig"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { setDoc, doc } from "firebase/firestore"

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [instagramHandle, setInstagramHandle] = useState("")

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await setDoc(doc(db, "artists", user.uid), {
        name,
        email,
        instagramHandle,
        bio: "",
        artworks: [],
      })

      Alert.alert("Success", "Account created successfully!")
      navigation.navigate("Login")
    } catch (error) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Instagram Handle"
        value={instagramHandle}
        onChangeText={setInstagramHandle}
      />
      <Button title="Sign Up" onPress={handleSignUp} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
})

