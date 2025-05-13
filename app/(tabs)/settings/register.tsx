import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
} from "react-native";
import useUserStore from "@/store/useUserStore";
import useSocketStore from "@/store/useSocketStore";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "@/utils/api";
import Toast from "react-native-toast-message";

const genders = ["Male", "Female", "Unknown"]; // Match backend enum

const SetUpProfile = () => {
  const { user, setUser } = useUserStore();
  const { connectSocket, setUsername } = useSocketStore();
  const navigation = useNavigation();

  const [user_name, setUserName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (user) {
      setUserName(user.user_name || "");
      setBio(user.bio || "");
      setGender(user.gender || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user_name || !gender) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please fill in username and gender.",
      });
      return;
    }

    try {
      const response = await api.post("/api/users/create", {
        user_name,
        gender,
        bio,
        interests: [],
        userId: user?._id,
      });

      const updatedUser = response.data.user;
      setUser(updatedUser);
      setUsername(updatedUser.user_name);

      // Validate and connect socket
      if (updatedUser._id && /^[0-9a-fA-F]{24}$/.test(updatedUser._id.toString())) {
        connectSocket(updatedUser._id.toString());
      } else {
        console.error("Invalid user ID for socket connection:", updatedUser._id);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Invalid user ID. Please try again.",
        });
        return;
      }

      Toast.show({
        type: "success",
        text1: "Profile Updated",
        text2: "Your profile has been saved! 🎉",
      });
      navigation.goBack();
    } catch (error: any) {
      console.error("Profile setup error:", error);
      const errorMessage = error.response?.data?.message || "Failed to save profile. Please try again.";
      Toast.show({
        type: "error",
        text1: "Error",
        text2: errorMessage,
      });
    }
  };

  const handleRandomUsername = () => {
    const randomNames = ["StarGazer", "MoonWalker", "SkyDiver", "DreamChaser"];
    setUserName(randomNames[Math.floor(Math.random() * randomNames.length)]);
  };

  return (
    <View className="flex-1 bg-[#1C1C3A]">
      <View className="flex-row items-center justify-between px-4 py-5 border-b border-b-gray-700 bg-[#1C1C3A]">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-white font-medium text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold">Set Up Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text className="text-indigo-400 font-medium text-base">Save</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pt-8">
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="person-outline" size={18} color="white" />
            <Text className="text-white font-medium">Nickname</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">NICKNAME WILL BE SHOWN IN CHAT</Text>
          <TextInput
            placeholder="Enter your nickname"
            placeholderTextColor="#aaa"
            value={user_name}
            onChangeText={setUserName}
            className="bg-[#2E2E4D] text-white p-4 rounded-xl"
          />
          <TouchableOpacity
            onPress={handleRandomUsername}
            className="bg-indigo-500 py-3 rounded-xl mt-3"
          >
            <Text className="text-white font-medium text-center">Random nickname</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="information-circle-outline" size={18} color="white" />
            <Text className="text-white font-medium">About me</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">
            Add a few words about yourself to interest your partner
          </Text>
          <TextInput
            placeholder="Tell us about yourself"
            placeholderTextColor="#aaa"
            value={bio}
            onChangeText={setBio}
            className="bg-[#2E2E4D] text-white p-4 rounded-xl h-32"
            multiline
            textAlignVertical="top"
          />
        </View>

        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="person-circle-outline" size={18} color="white" />
            <Text className="text-white font-medium">My gender</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">
            Choose your gender to get better matches
          </Text>
          <View className="flex-col gap-3">
            {genders.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                className={`py-3 px-4 rounded-xl ${
                  gender === g ? "bg-indigo-500" : "bg-[#2E2E4D]"
                }`}
              >
                <Text className="text-white font-medium">{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default SetUpProfile;