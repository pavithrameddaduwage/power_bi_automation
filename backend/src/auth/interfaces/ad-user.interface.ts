export interface ADUser {
    displayName: string;
    sAMAccountName: string;
    mail: string;
    department?: string;
    location?: string;
}