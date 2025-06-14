import { LaunchData, LaunchpadData } from '../types';

export class SpaceXAgent {
  private static readonly BASE_URL = 'https://api.spacexdata.com/v4';
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 1000;

  static async fetchNextLaunch(): Promise<{ launch: LaunchData; launchpad: LaunchpadData }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        // Fetch upcoming launches instead of just "next"
        const launchResponse = await fetch(`${this.BASE_URL}/launches/upcoming`);
        if (!launchResponse.ok) {
          throw new Error(`Launch API responded with status: ${launchResponse.status}`);
        }
        
        const upcomingLaunches: LaunchData[] = await launchResponse.json();
        
        if (!upcomingLaunches || upcomingLaunches.length === 0) {
          throw new Error('No upcoming launches found');
        }

        // Sort launches by date to get the truly next one
        const sortedLaunches = upcomingLaunches
          .filter(launch => launch.date_utc && new Date(launch.date_utc) > new Date())
          .sort((a, b) => new Date(a.date_utc).getTime() - new Date(b.date_utc).getTime());

        if (sortedLaunches.length === 0) {
          throw new Error('No future launches found in upcoming launches');
        }

        const nextLaunch = sortedLaunches[0];

        // Fetch launchpad details
        const launchpadResponse = await fetch(`${this.BASE_URL}/launchpads/${nextLaunch.launchpad}`);
        if (!launchpadResponse.ok) {
          throw new Error(`Launchpad API responded with status: ${launchpadResponse.status}`);
        }
        
        const launchpad: LaunchpadData = await launchpadResponse.json();

        return { launch: nextLaunch, launchpad };
      } catch (error) {
        lastError = error as Error;
        console.warn(`SpaceX API attempt ${attempt} failed:`, error);
        
        if (attempt < this.RETRY_ATTEMPTS) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    throw lastError || new Error('Failed to fetch SpaceX launch data');
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatLaunchData(launch: LaunchData, launchpad: LaunchpadData) {
    const launchDate = new Date(launch.date_utc);
    const now = new Date();
    const timeDiff = launchDate.getTime() - now.getTime();
    const daysUntilLaunch = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return {
      missionName: launch.name,
      launchDate: launchDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      daysUntilLaunch,
      launchSite: launchpad.full_name,
      location: `${launchpad.locality}, ${launchpad.region}`,
      coordinates: {
        lat: launchpad.latitude,
        lng: launchpad.longitude
      },
      details: launch.details || 'No mission details available',
      links: launch.links
    };
  }
}