import { Injectable } from '@angular/core';
import { HttpClient } from  '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  baseUrl = 'https://kumaruidivloper.github.io/JsonServer/Profile_data.json'

  constructor(private http: HttpClient) { }

  getData() {
    return this.http.get(this.baseUrl);
  };
}
