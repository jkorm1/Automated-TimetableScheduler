import { useState, useEffect } from "react"
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList } from "react-native"
import { auth, db } from "../firebaseConfig"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"

export default function MyProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const userDoc = doc(db, "artists", auth.currentUser.uid)
      const userSnapshot = await getDoc(userDoc)
      if (userSnapshot.exists()) {
        setProfile({ id: userSnapshot.id, ...userSnapshot.data() })
      }
    }

    fetchProfile()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      // Navigation will be handled by the auth state listener in App.js
    } catch (error) {
      Alert.alert("Error", "Failed to log out. Please try again.")
    }
  }

  const renderArtwork = ({ item }) => (
    <View style={styles.artworkCard}>
      <Image source={{ uri: item.imageUrl }} style={styles.artworkImage} />
      <Text style={styles.artworkTitle}>{item.title}</Text>
    </View>
  )

  if (!profile) {
    return <Text>Loading...</Text>
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: profile.profileImage || "https://via.placeholder.com/150" }}
          style={styles.profileImage}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.instagram}>{profile.instagramHandle}</Text>
        </View>
      </View>
      <Text style={styles.bio}>{profile.bio}</Text>
      <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate("EditProfile")}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>My Artworks</Text>
      <FlatList
        data={profile.artworks}
        renderItem={renderArtwork}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
      />
      <TouchableOpacity style={styles.addArtworkButton} onPress={() => navigation.navigate("AddArtwork")}>
        <Text style={styles.addArtworkButtonText}>Add New Artwork</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  header: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: "white",
    alignItems: "center",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
  },
  instagram: {
    fontSize: 16,
    color: "#666",
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
  },
  editButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 5,
    margin: 20,
  },
  editButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    padding: 20,
  },
  artworkCard: {
    flex: 1,
    margin: 5,
    maxWidth: "47%",
  },
  artworkImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
  },
  artworkTitle: {
    marginTop: 5,
    fontSize: 14,
    textAlign: "center",
  },
  addArtworkButton: {
    backgroundColor: "#4CD964",
    padding: 10,
    borderRadius: 5,
    margin: 20,
  },
  addArtworkButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    padding: 10,
    borderRadius: 5,
    margin: 20,
  },
  logoutButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
})

