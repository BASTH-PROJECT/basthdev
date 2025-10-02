import React from 'react';
import { View } from 'react-native';

export default function DefaultTemplate() {
  return <View></View>;
}

// import React from 'react';
// import {
//     StatusBar,
//     StyleSheet,
//     Text,
//     View,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import Header from './components/header';

// export default function Settings() {

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
//       <Header />

//       <View style={styles.content}>
//         <Text style={styles.title}>Settings</Text>
//         <Text style={styles.subtitle}>Settings screen coming soon...</Text>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   content: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#333',
//     marginBottom: 10,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#666',
//     textAlign: 'center',
//   },
// });
