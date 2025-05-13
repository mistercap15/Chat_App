import { View } from "react-native";

const SkeletonCard = () => (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow">
      <View className="flex-row items-center">
        <View className="bg-amber-100 p-3 rounded-full mr-4 w-12 h-12" />
        <View className="flex-1 space-y-2">
          <View className="bg-amber-100 h-4 w-3/4 rounded" />
          <View className="bg-gray-200 h-3 w-1/2 rounded" />
        </View>
      </View>
      <View className="mt-4">
        <View className="bg-yellow-100 h-2 w-full rounded" />
        <View className="mt-2 bg-gray-200 h-3 w-1/4 rounded self-end" />
      </View>
    </View>
  );
  
  export default SkeletonCard;