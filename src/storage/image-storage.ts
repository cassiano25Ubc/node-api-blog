export interface ImageStorage {
  saveAvatar(image: Buffer): Promise<string>;
  remove(relativePath: string): Promise<void>;
}
