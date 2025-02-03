import { useEffect, useState } from "react"
import { View, Text, Image, StyleSheet, ScrollView, FlatList } from "react-native"
import { db } from "../firebaseConfig"
import { doc, getDoc } from "firebase/firestore"

export default function ArtistDetailScreen({ route }) {
  const { artistId } = route.params
  const [artist, setArtist] = useState(null)

  useEffect(() => {
    const fetchArtist = async () => {
      const artistDoc = doc(db, "artists", artistId)
      const artistSnapshot = await getDoc(artistDoc)
      if (artistSnapshot.exists()) {
        setArtist({ id: artistSnapshot.id, ...artistSnapshot.data() })
      }
    }

    fetchArtist()
  }, [artistId])

  if (!artist) {
    return <Text>Loading...</Text>
  }

  const renderArtwork = ({ item }) => (
    <View style={styles.artworkCard}>
      <Image source={{ uri: item.imageUrl }} style={styles.artworkImage} />
      <Text style={styles.artworkTitle}>{item.title}</Text>
    </View>
  )

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: artist.profileImage || "https://via.placeholder.com/150" }} style={styles.profileImage} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{artist.name}</Text>
          <Text style={styles.instagram}>{artist.instagramHandle}</Text>
        </View>
      </View>
      <Text style={styles.bio}>{artist.bio}</Text>
      <Text style={styles.sectionTitle}>Artworks</Text>
      <FlatList
        data={artist.artworks}
        renderItem={renderArtwork}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
      />
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
})

