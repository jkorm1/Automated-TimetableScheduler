import { useEffect, useState } from "react"
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from "react-native"
import { db } from "../firebaseConfig"
import { collection, getDocs } from "firebase/firestore"
import ShopCard from "../components/ShopCard"

export default function HomeScreen({ navigation }) {
  const [artists, setArtists] = useState([])

  useEffect(() => {
    const fetchArtists = async () => {
      const artistsCollection = collection(db, "artists")
      const artistSnapshot = await getDocs(artistsCollection)
      const artistList = artistSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setArtists(artistList)
    }

    fetchArtists()
  }, [])

  const renderShopCard = ({ item }) => (
    <ShopCard
      artist={item}
      onPress={() => navigation.navigate("ArtistDetail", { artistId: item.id, artistName: item.name })}
    />
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("MyProfile")}>
        <Text style={styles.profileButtonText}>My Shop</Text>
      </TouchableOpacity>
      <FlatList
        data={artists}
        renderItem={renderShopCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  listContainer: {
    padding: 10,
  },
  profileButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
  profileButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
})

