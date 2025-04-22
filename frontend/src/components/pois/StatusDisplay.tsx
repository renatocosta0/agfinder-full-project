import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { Contribution } from '../../types/pois';
import StatusIndicator from './StatusIndicator';

interface StatusDisplayProps {
  contribution: Contribution;
  poiType: 'atm' | 'gasstation';
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ contribution, poiType }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getTimeLeft = () => {
    if (contribution.isExpired) {
      return 'Expired';
    }
    
    const expiresAt = new Date(contribution.expiresAt);
    const now = new Date();
    const diffInHours = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours} hours left`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days left`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Status</Text>
        <Text style={styles.timeLeft}>{getTimeLeft()}</Text>
      </View>
      
      <View style={styles.statusRow}>
        <StatusIndicator 
          status={contribution.contributionType} 
          poiType={poiType} 
          size="large" 
        />
        <Text style={styles.date}>
          Reported on {formatDate(contribution.createdAt)}
        </Text>
      </View>
      
      <View style={styles.contributorRow}>
        <View style={styles.contributorInfo}>
          {contribution.userProfilePicture ? (
            <Image 
              source={{ uri: contribution.userProfilePicture }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.avatarText}>
                {contribution.userName.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.contributorName}>
            By {contribution.userName}
          </Text>
        </View>
        
        <View style={styles.validationInfo}>
          <Text style={styles.validationText}>
            <Text style={styles.validText}>{contribution.validCount} valid</Text>
            {' · '}
            <Text style={styles.reportText}>{contribution.reportCount} reports</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Layout.borderRadius.medium,
    padding: Layout.padding.medium,
    ...Layout.shadow.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.padding.medium,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  timeLeft: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.padding.medium,
  },
  date: {
    marginLeft: Layout.padding.medium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  contributorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Layout.padding.small,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  contributorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: Layout.padding.small,
  },
  placeholderAvatar: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  contributorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  validationInfo: {
    alignItems: 'flex-end',
  },
  validationText: {
    fontSize: 14,
  },
  validText: {
    color: Colors.success,
  },
  reportText: {
    color: Colors.danger,
  },
});

export default StatusDisplay; 