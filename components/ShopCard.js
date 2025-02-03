import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native"

export default function ShopCard({ artist, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: artist.bestArtwork }} style={styles.image} />
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{artist.name}</Text>
        <Text style={styles.instagram}>{artist.instagramHandle}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    margin: 5,
    overflow: "hidden",
    elevation: 3,
    flex: 1,
    maxWidth: "47%",
  },
  image: {
    width: "100%",
    height: 150,
    resizeMode: "cover",
  },
  infoContainer: {
    padding: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
  },
  instagram: {
    fontSize: 14,
    color: "#666",
  },
})

